import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createHmac, createHash } from 'node:crypto'
import { request as httpsRequest } from 'node:https'

const ENV_FILE = join(import.meta.dirname, '../.env.deploy')
const DIST_DIR = join(import.meta.dirname, '../dist')

function loadEnv() {
  const content = readFileSync(ENV_FILE, 'utf8')
  const env: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match) env[match[1]] = match[2].trim()
  }
  return env
}

function walkDir(dir: string, files: string[] = []) {
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name)
    if (statSync(fullPath).isDirectory()) walkDir(fullPath, files)
    else files.push(fullPath)
  }
  return files
}

function getMimeType(file: string) {
  if (file.endsWith('.js')) return 'application/javascript'
  if (file.endsWith('.css')) return 'text/css'
  if (file.endsWith('.html')) return 'text/html'
  if (file.endsWith('.json')) return 'application/json'
  if (file.endsWith('.svg')) return 'image/svg+xml'
  if (file.endsWith('.png')) return 'image/png'
  if (file.endsWith('.jpg')) return 'image/jpeg'
  if (file.endsWith('.gz')) return 'application/gzip'
  return 'application/octet-stream'
}

function sign(secretId: string, secretKey: string, method: string, path: string, headers: Record<string, string>, expires = 3600) {
  const now = Math.floor(Date.now() / 1000)
  const keyTime = `${now};${now + expires}`
  const signKey = createHmac('sha1', secretKey).update(keyTime).digest('hex')

  const httpString = `${method.toLowerCase()}\n${path}\n\nhost=${headers['Host']}\n`
  const sha1edHttpString = createHash('sha1').update(httpString).digest('hex')
  const stringToSign = `sha1\n${keyTime}\n${sha1edHttpString}\n`
  const signature = createHmac('sha1', signKey).update(stringToSign).digest('hex')

  return `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=host&q-url-param-list=&q-signature=${signature}`
}

function uploadFile(env: Record<string, string>, localPath: string, cosKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = readFileSync(localPath)
    const host = `${env.COS_BUCKET}.cos.${env.COS_REGION}.myqcloud.com`
    const path = `/${cosKey}`
    const contentType = getMimeType(localPath)
    const headers: Record<string, string> = { Host: host }
    const authorization = sign(env.COS_SECRET_ID, env.COS_SECRET_KEY, 'PUT', path, headers)

    const req = httpsRequest({
      hostname: host,
      port: 443,
      path,
      method: 'PUT',
      headers: {
        'Host': host,
        'Content-Type': contentType,
        'Content-Length': String(body.length),
        'Authorization': authorization,
        ...(cosKey.endsWith('.gz') ? {} : cosKey.match(/\.[a-f0-9]{8}\./) ? { 'Cache-Control': 'public, max-age=31536000, immutable' } : { 'Cache-Control': 'no-cache' }),
      },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        resolve()
      } else {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => reject(new Error(`PUT ${cosKey} failed: ${res.statusCode} ${Buffer.concat(chunks).toString()}`)))
      }
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function main() {
  const env = loadEnv()
  if (!env.COS_SECRET_ID || !env.COS_SECRET_KEY) {
    console.error('missing COS credentials in .env.deploy')
    process.exit(1)
  }

  const files = walkDir(DIST_DIR)
  console.log(`uploading ${files.length} files to cos://${env.COS_BUCKET}/${env.COS_PREFIX}`)

  let uploaded = 0
  for (const file of files) {
    const rel = relative(DIST_DIR, file).replace(/\\/g, '/')
    const cosKey = `${env.COS_PREFIX}${rel}`
    await uploadFile(env, file, cosKey)
    uploaded++
    if (uploaded % 10 === 0) console.log(`  ${uploaded}/${files.length}`)
  }
  console.log(`done: ${uploaded} files uploaded`)
  console.log(`CDN URL: https://www.cfzzbsq.cloud/${env.COS_PREFIX}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
