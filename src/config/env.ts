const env =
  typeof process !== 'undefined' && process.env
    ? process.env
    : {}

export const MINIAPP_PLATFORM = env.TARO_ENV || 'weapp'
export const IS_WEAPP = MINIAPP_PLATFORM === 'weapp'

export const MINIAPP_ENV = {
  platform: MINIAPP_PLATFORM,
  apiBase: env.TARO_APP_API_BASE || 'http://127.0.0.1:3001/api',
  useCloudGateway: env.TARO_APP_USE_CLOUD_GATEWAY !== 'false',
  cloudGatewayName: env.TARO_APP_CLOUD_GATEWAY_NAME || 'nursingGateway',
  useMockFallback: env.TARO_APP_USE_MOCK_FALLBACK === 'true',
  devOpenId: env.TARO_APP_DEV_OPEN_ID || '',
  devTokenCode: env.TARO_APP_DEV_TOKEN_CODE || '',
}
