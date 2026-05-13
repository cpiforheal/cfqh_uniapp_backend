#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const targetRoot = process.argv[2] ? path.resolve(process.argv[2]) : root
const distDir = path.join(targetRoot, 'dist')

const forbiddenPatterns = [
  { pattern: 'http://127.0.0.1:3001/api', message: 'dist contains local API base' },
  { pattern: 'local-weapp-debug-openid', message: 'dist contains local dev openId' },
  { pattern: 'dev-open-id-local', message: 'dist contains api dev openId placeholder' },
  { pattern: 'skipWechatLogin: "true" ===', message: 'dist skips WeChat login' },
  { pattern: 'useCloudGateway: "false" !==', message: 'dist disables cloud gateway' },
  { pattern: 'useMockFallback: "true" ===', message: 'dist enables mock fallback' },
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
  console.error('miniapp dist check failed: dist/ does not exist')
  process.exit(1)
}

const files = walk(distDir).filter((file) => file.endsWith('.js'))
const failures = []

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8')
  for (const item of forbiddenPatterns) {
    if (content.includes(item.pattern)) {
      failures.push(`${path.relative(root, file)}: ${item.message}`)
    }
  }
}

if (failures.length > 0) {
  console.error(`miniapp dist check failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log(`miniapp dist check passed: ${path.relative(root, distDir) || 'dist'}`)
