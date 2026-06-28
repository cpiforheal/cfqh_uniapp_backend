#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const targetRoot = process.argv[2] ? path.resolve(process.argv[2]) : root
const distDir = path.join(targetRoot, 'dist')

const requiredPatterns = [
  { patterns: ['http://127.0.0.1:3001/api'], message: 'dist does not contain local API base' },
  { patterns: ['local-weapp-debug-openid'], message: 'dist does not contain local dev openId' },
  { patterns: ['useCloudGateway:!1', 'useCloudGateway: "false" !=='], message: 'dist still enables cloud gateway' },
  { patterns: ['skipWechatLogin:!0', 'skipWechatLogin: "true" ==='], message: 'dist still requires wx.login' },
]

const forbiddenPatterns = [
  { pattern: 'useCloudGateway:!0', message: 'dist enables cloud gateway' },
  { pattern: 'apiBase:""', message: 'dist has empty API base' },
]

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(fullPath)
    return fullPath
  })
}

if (!fs.existsSync(distDir)) {
  console.error('miniapp local dist check failed: dist/ does not exist')
  process.exit(1)
}

const content = walk(distDir)
  .filter((file) => file.endsWith('.js'))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')

const failures = []

if (content.includes('/prebundle/') && !fs.existsSync(path.join(distDir, 'prebundle'))) {
  failures.push('dist references prebundle files, but dist/prebundle/ does not exist')
}

for (const item of requiredPatterns) {
  if (!item.patterns.some((pattern) => content.includes(pattern))) failures.push(item.message)
}

for (const item of forbiddenPatterns) {
  if (content.includes(item.pattern)) failures.push(item.message)
}

if (failures.length > 0) {
  console.error(`miniapp local dist check failed:\n- ${failures.join('\n- ')}`)
  console.error('Run `pnpm dev:weapp` or `pnpm build:weapp:devtools`, then reopen/compile dist/ in WeChat DevTools.')
  process.exit(1)
}

console.log(`miniapp local dist check passed: ${path.relative(root, distDir) || 'dist'}`)
