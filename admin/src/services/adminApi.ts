const API_BASE = process.env.UMI_APP_API_BASE || 'http://127.0.0.1:3001/api'
const ADMIN_TOKEN_KEY = 'cfqh_admin_token'
const ADMIN_SESSION_KEY = 'cfqh_admin_session'
const DEFAULT_ADMIN_TOKEN = process.env.UMI_APP_DEFAULT_ADMIN_TOKEN || ''
const LOCAL_DEV_ADMIN_TOKEN = 'cfqh-admin-dev-token'

function isLocalHost() {
  if (typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1'].includes(window.location.hostname)
}

export function getAdminToken() {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_TOKEN
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || DEFAULT_ADMIN_TOKEN || (isLocalHost() ? LOCAL_DEV_ADMIN_TOKEN : '')
}

export function getAdminSessionToken() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(ADMIN_SESSION_KEY) || ''
}

export function setAdminSessionToken(token: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ADMIN_SESSION_KEY, token)
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ADMIN_SESSION_KEY)
}

export function setAdminToken(token: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(getAdminSessionToken() ? { Authorization: `Bearer ${getAdminSessionToken()}`, 'x-admin-session': getAdminSessionToken() } : {}),
    ...(!getAdminSessionToken() && getAdminToken() ? { 'x-admin-token': getAdminToken() } : {}),
    ...(init?.headers || {}),
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`后台接口请求失败：HTTP ${response.status}${detail ? ` ${detail}` : ''}`)
  }

  return response.json() as Promise<T>
}

export function describeAdminFetchError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback
  const message = error.message || ''
  if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('Network request failed')) {
    return `无法连接后端服务：${API_BASE}。请确认 API 已启动、地址正确，或本地代理/跨域未被拦截。`
  }

  const match = message.match(/^后台接口请求失败：HTTP\s+(\d+)\s*(.*)$/)
  if (!match) return message || fallback

  const status = Number(match[1])
  const detail = match[2]?.trim()
  let serverMessage = ''
  if (detail) {
    try {
      const parsed = JSON.parse(detail) as { message?: unknown; error?: unknown }
      if (Array.isArray(parsed.message)) serverMessage = parsed.message.join('；')
      else if (typeof parsed.message === 'string') serverMessage = parsed.message
      else if (typeof parsed.error === 'string') serverMessage = parsed.error
    } catch {
      serverMessage = detail
    }
  }

  if (status === 401) return `后台登录已失效，请重新登录。${serverMessage ? `后端返回：${serverMessage}` : ''}`
  if (status === 404) return `接口不存在：${API_BASE}。请确认后端已部署/重启到最新版本。`
  if (status >= 500) return `后端接口异常。若刚更新过代码，请先执行 Prisma db push 并重启 API。${serverMessage ? `后端返回：${serverMessage}` : ''}`
  return serverMessage || fallback
}

export { API_BASE, DEFAULT_ADMIN_TOKEN }
