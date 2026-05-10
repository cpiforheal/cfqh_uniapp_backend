export const MINIAPP_PLATFORM = process.env.TARO_ENV || 'weapp'
export const IS_WEAPP = MINIAPP_PLATFORM === 'weapp'

export const MINIAPP_ENV = {
  platform: MINIAPP_PLATFORM,
  apiBase: process.env.TARO_APP_API_BASE || 'http://127.0.0.1:3001/api',
  apiFallbackBases: (process.env.TARO_APP_API_FALLBACK_BASES || '').split(',').map((item) => item.trim()).filter(Boolean),
  useCloudGateway: process.env.TARO_APP_USE_CLOUD_GATEWAY !== 'false',
  cloudGatewayName: process.env.TARO_APP_CLOUD_GATEWAY_NAME || 'nursingGateway',
  useMockFallback: process.env.TARO_APP_USE_MOCK_FALLBACK === 'true',
  devOpenId: process.env.TARO_APP_DEV_OPEN_ID || '',
  devTokenCode: process.env.TARO_APP_DEV_TOKEN_CODE || '',
  skipWechatLogin: process.env.TARO_APP_SKIP_WECHAT_LOGIN === 'true',
}
