const cloud = require('wx-server-sdk')
const http = require('http')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const DEFAULT_API_BASE = 'http://127.0.0.1:3001/api'
const ALLOWED_METHODS = new Set(['GET', 'POST', 'DELETE'])

function getApiBase() {
  const configuredBase = String(process.env.API_BASE || '').trim()
  if (configuredBase) return configuredBase.replace(/\/$/, '')
  if (process.env.ALLOW_DEV_OPEN_ID === 'true') return DEFAULT_API_BASE
  throw new Error('missing API_BASE for nursingGateway')
}

function getGatewaySecret() {
  return process.env.GATEWAY_SECRET || ''
}

function normalizePath(path) {
  const raw = String(path || '').trim()
  if (!raw || raw.includes('://')) return ''
  return raw.startsWith('/') ? raw : `/${raw}`
}

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const body = options.body || ''
    const client = target.protocol === 'http:' ? http : https
    const request = client.request(
      target,
      {
        method: options.method || 'GET',
        headers: {
          ...(options.headers || {}),
          ...(body ? { 'content-length': Buffer.byteLength(body) } : {}),
        },
        timeout: 15000,
      },
      (response) => {
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let data
          try {
            data = JSON.parse(text)
          } catch {
            data = text
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`HTTP ${response.statusCode}: ${typeof data === 'string' ? data : JSON.stringify(data)}`))
            return
          }

          resolve(data)
        })
      },
    )

    request.on('timeout', () => {
      request.destroy(new Error(`request timeout: ${target.origin}`))
    })
    request.on('error', reject)
    if (body) request.write(body)
    request.end()
  })
}

async function proxyRequest({ path, method = 'GET', data }, openId) {
  const normalizedPath = normalizePath(path)
  if (!normalizedPath) return { ok: false, error: 'missing or invalid path' }

  const normalizedMethod = String(method || 'GET').toUpperCase()
  if (!ALLOWED_METHODS.has(normalizedMethod)) {
    return { ok: false, error: `unsupported method: ${normalizedMethod}` }
  }

  const headers = {
    'content-type': 'application/json',
    ...(openId ? { 'x-open-id': openId } : {}),
    ...(getGatewaySecret() ? { 'x-gateway-secret': getGatewaySecret() } : {}),
  }

  const url = `${getApiBase()}${normalizedPath}`
  const result = await requestJson(url, {
    method: normalizedMethod,
    headers,
    ...(normalizedMethod === 'GET' ? {} : { body: JSON.stringify(data || {}) }),
  })

  return { ok: true, data: result }
}

function legacyActionToProxy(event) {
  const payload = event?.payload || {}
  if (event?.action === 'practiceHome') return { path: '/practice-home', method: 'GET' }
  if (event?.action === 'questionBank') return { path: '/catalog', method: 'GET' }
  if (event?.action === 'questionDetail') return { path: `/questions/${payload.id || ''}`, method: 'GET' }
  return null
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID || (process.env.ALLOW_DEV_OPEN_ID === 'true' ? process.env.DEV_OPEN_ID : '') || ''
  const proxyEvent = event?.path ? event : legacyActionToProxy(event)

  if (!proxyEvent) {
    return { ok: false, error: 'missing proxy path' }
  }

  try {
    return await proxyRequest(proxyEvent, openId)
  } catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
}
