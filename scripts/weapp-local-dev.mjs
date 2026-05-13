import { spawn } from 'node:child_process'
import os from 'node:os'

function getLanIp() {
  const interfaces = os.networkInterfaces()
  const candidates = []

  for (const [name, addresses = []] of Object.entries(interfaces)) {
    for (const address of addresses) {
      if (address.family !== 'IPv4' || address.internal) continue
      candidates.push({ name, address: address.address })
    }
  }

  const preferred =
    candidates.find((item) => item.name === 'en0') ||
    candidates.find((item) => item.address.startsWith('192.168.')) ||
    candidates.find((item) => item.address.startsWith('10.')) ||
    candidates[0]

  return preferred?.address || '127.0.0.1'
}

const target = process.env.CFQH_LOCAL_TARGET || 'lan'
const lanIp = process.env.CFQH_LOCAL_IP || getLanIp()
const defaultHost = target === 'devtools' ? '127.0.0.1' : lanIp
const apiBase = process.env.TARO_APP_API_BASE || `http://${defaultHost}:3001/api`
const fallbackBases = process.env.TARO_APP_API_FALLBACK_BASES || [`http://127.0.0.1:3001/api`, `http://${lanIp}:3001/api`]
  .filter((item) => item !== apiBase)
  .join(',')
const devOpenId = process.env.TARO_APP_DEV_OPEN_ID || 'local-weapp-debug-openid'
const skipWechatLogin = process.env.TARO_APP_SKIP_WECHAT_LOGIN || (target === 'devtools' ? 'true' : 'false')

const child = spawn(
  'pnpm',
  ['exec', 'taro', 'build', '--type', 'weapp', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      TARO_APP_API_BASE: apiBase,
      TARO_APP_API_FALLBACK_BASES: fallbackBases,
      TARO_APP_USE_CLOUD_GATEWAY: 'false',
      TARO_APP_USE_MOCK_FALLBACK: 'false',
      TARO_APP_DEBUG_API: process.env.TARO_APP_DEBUG_API || 'true',
      TARO_APP_DEV_OPEN_ID: devOpenId,
      TARO_APP_SKIP_WECHAT_LOGIN: skipWechatLogin,
    },
  },
)

console.log(`[cfqh] Local weapp API: ${apiBase}`)
console.log(`[cfqh] Local weapp fallback APIs: ${fallbackBases || 'none'}`)
console.log(`[cfqh] Local fallback openId: ${devOpenId}`)
console.log(`[cfqh] Skip wx.login in local build: ${skipWechatLogin}`)
console.log('[cfqh] Cloud gateway disabled for local true-device debugging.')

child.on('exit', (code) => {
  process.exit(code || 0)
})
