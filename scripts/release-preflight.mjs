#!/usr/bin/env node

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const production = args.has('--production')
const strictGit = args.has('--strict-git')

const results = []

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function pass(message) {
  results.push({ level: 'pass', message })
}

function warn(message) {
  results.push({ level: 'warn', message })
}

function fail(message) {
  results.push({ level: 'fail', message })
}

function check(condition, message, failure = message) {
  if (condition) pass(message)
  else fail(failure)
}

function isBlank(value) {
  return !String(value || '').trim()
}

function looksPlaceholder(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return (
    normalized.includes('replace-with') ||
    normalized.includes('请替换') ||
    normalized.includes('your-') ||
    normalized.includes('placeholder')
  )
}

function unsafeSecret(value, devValue) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return true
  if (devValue && trimmed === devValue) return true
  return trimmed.length < 16 || looksPlaceholder(trimmed)
}

function checkStaticReleaseGuards() {
  const projectConfig = JSON.parse(read('project.config.json'))
  check(projectConfig.cloudfunctionRoot === 'cloudfunctions/', '微信项目配置包含 cloudfunctionRoot')
  check(projectConfig.miniprogramRoot === 'dist/', '微信项目配置指向 dist 小程序产物')
  check(Boolean(projectConfig.appid), '微信项目配置包含 appid')

  const miniEnv = read('src/config/env.ts')
  check(miniEnv.includes("useCloudGateway: process.env.TARO_APP_USE_CLOUD_GATEWAY !== 'false'"), '小程序默认使用云函数网关')
  check(miniEnv.includes("useMockFallback: process.env.TARO_APP_USE_MOCK_FALLBACK === 'true'"), '小程序 mock 兜底必须显式开启')
  check(miniEnv.includes("devOpenId: process.env.TARO_APP_DEV_OPEN_ID || ''"), '小程序 dev openId 默认留空')

  const gateway = read('cloudfunctions/nursingGateway/index.js')
  check(gateway.includes("'x-open-id': openId"), '云函数转发微信 openId')
  check(gateway.includes("'x-gateway-secret': getGatewaySecret()"), '云函数转发网关密钥')
  check(gateway.includes("path: '/catalog'"), '云函数 questionBank action 指向 /catalog')
  check(gateway.includes("throw new Error('missing API_BASE for nursingGateway')"), '云函数缺少 API_BASE 时失败而不是打到本机')

  const currentUser = read('api/src/common/current-user.ts')
  check(currentUser.includes('!isProduction(configService)') && currentUser.includes("ALLOW_DEV_OPEN_ID') === 'true'"), 'API 生产环境禁用 dev openId 回退')

  const main = read('api/src/main.ts')
  check(main.includes('assertProductionEnv()'), 'API 启动前执行生产环境校验')

  const adminGuard = read('api/src/common/guards/admin.guard.ts')
  check(adminGuard.includes("isProduction ? '' : 'cfqh-admin-dev-token'"), '后台默认 token 只在非生产环境启用')

  const gitignore = read('.gitignore')
  check(gitignore.includes('.logs/') && gitignore.includes('*.db-wal') && gitignore.includes('*.db-shm'), '本地日志和 SQLite 临时文件不会误提交')
  check(gitignore.includes('plugins/'), '本地插件实验目录不会误提交')
}

function checkGitStatus() {
  let status = ''
  try {
    status = execSync('git status --short', { cwd: root, encoding: 'utf8' }).trim()
  } catch (error) {
    warn(`无法读取 git status：${error.message}`)
    return
  }

  if (!status) {
    pass('工作区干净')
    return
  }

  const riskyLines = status.split('\n').filter((line) => /\.logs\/|\.db-shm|\.db-wal|^.. plugins\//.test(line))
  if (strictGit) fail(`工作区存在未收敛改动，发布前请清理或明确提交：\n${status}`)
  else warn(`工作区存在改动，发布前请确认提交边界：\n${status}`)

  if (riskyLines.length > 0) {
    if (strictGit) fail(`发现本地临时/实验文件仍在工作区：\n${riskyLines.join('\n')}`)
    else warn(`发现本地临时/实验文件，已由 .gitignore 防误提交，但发布前仍建议清理：\n${riskyLines.join('\n')}`)
  }
}

function checkProductionEnv() {
  if (!production) {
    warn('未启用 --production，跳过真实生产环境变量校验')
    return
  }

  const env = process.env
  check(env.NODE_ENV === 'production', 'NODE_ENV=production', 'NODE_ENV 必须为 production')
  check(!isBlank(env.DATABASE_URL), 'DATABASE_URL 已配置', 'DATABASE_URL 未配置')
  check(!/(\.\/|\/|\\)dev\.db($|\?)/.test(String(env.DATABASE_URL || '')), 'DATABASE_URL 未指向 dev.db', 'DATABASE_URL 不能指向 dev.db')
  check(env.ALLOW_DEV_OPEN_ID !== 'true', 'ALLOW_DEV_OPEN_ID 未开启', '生产环境必须关闭 ALLOW_DEV_OPEN_ID')
  check(isBlank(env.DEV_OPEN_ID), 'DEV_OPEN_ID 留空', '生产环境 DEV_OPEN_ID 必须留空')
  check(!unsafeSecret(env.ADMIN_TOKEN, 'cfqh-admin-dev-token'), 'ADMIN_TOKEN 是正式密钥', 'ADMIN_TOKEN 为空、过短或仍是默认值')
  check(!unsafeSecret(env.GATEWAY_SECRET), 'GATEWAY_SECRET 是正式密钥', 'GATEWAY_SECRET 为空、过短或仍是占位值')
  check(!isBlank(env.WECHAT_APP_ID) && !looksPlaceholder(env.WECHAT_APP_ID), 'WECHAT_APP_ID 已配置', 'WECHAT_APP_ID 未配置')
  check(!unsafeSecret(env.WECHAT_APP_SECRET), 'WECHAT_APP_SECRET 已配置', 'WECHAT_APP_SECRET 未配置或仍是占位值')

  check(process.env.TARO_APP_USE_CLOUD_GATEWAY !== 'false', '小程序生产构建未关闭云函数网关', 'TARO_APP_USE_CLOUD_GATEWAY 不能为 false')
  check(process.env.TARO_APP_USE_MOCK_FALLBACK !== 'true', '小程序生产构建未开启 mock fallback', 'TARO_APP_USE_MOCK_FALLBACK 不能为 true')
  check(isBlank(process.env.TARO_APP_DEV_OPEN_ID), '小程序生产构建未设置 dev openId', 'TARO_APP_DEV_OPEN_ID 必须为空')
  check(process.env.TARO_APP_SKIP_WECHAT_LOGIN !== 'true', '小程序生产构建未跳过微信登录', 'TARO_APP_SKIP_WECHAT_LOGIN 不能为 true')
}

function printResults() {
  const icon = { pass: 'PASS', warn: 'WARN', fail: 'FAIL' }
  for (const result of results) {
    console.log(`${icon[result.level]} ${result.message}`)
  }
  const failed = results.filter((result) => result.level === 'fail').length
  const warned = results.filter((result) => result.level === 'warn').length
  console.log(`\nrelease preflight: ${failed} failed, ${warned} warnings`)
  process.exit(failed > 0 ? 1 : 0)
}

check(exists('docs/launch-readiness.md'), '上线验收文档存在', '缺少 docs/launch-readiness.md')
checkStaticReleaseGuards()
checkGitStatus()
checkProductionEnv()
printResults()
