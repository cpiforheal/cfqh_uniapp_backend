import { validateProductionEnv } from './production-env'

describe('validateProductionEnv', () => {
  it('does not require production settings outside production', () => {
    expect(validateProductionEnv({ NODE_ENV: 'development' })).toEqual([])
  })

  it('rejects dev-only production settings', () => {
    const errors = validateProductionEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'file:./dev.db',
      ADMIN_TOKEN: 'cfqh-admin-dev-token',
      GATEWAY_SECRET: 'replace-with-shared-gateway-secret',
      ALLOW_DEV_OPEN_ID: 'true',
      DEV_OPEN_ID: 'local-open-id',
      WECHAT_APP_ID: 'wx-test',
      WECHAT_APP_SECRET: '',
    })

    expect(errors).toEqual(expect.arrayContaining([
      'DATABASE_URL must not point to dev.db in production.',
      'ALLOW_DEV_OPEN_ID must be false in production.',
      'DEV_OPEN_ID must be empty in production.',
      'ADMIN_TOKEN must be a non-default secret with at least 16 characters.',
      'GATEWAY_SECRET must be a non-placeholder secret with at least 16 characters.',
      'WECHAT_APP_SECRET must be configured as a real server-side secret.',
    ]))
  })

  it('accepts a complete production environment', () => {
    expect(validateProductionEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'file:/opt/cfqh/api/prod.db',
      ADMIN_TOKEN: 'admin-token-1234567890',
      GATEWAY_SECRET: 'gateway-secret-1234567890',
      ALLOW_DEV_OPEN_ID: 'false',
      DEV_OPEN_ID: '',
      WECHAT_APP_ID: 'wx9fa36f92c1775f62',
      WECHAT_APP_SECRET: 'wechat-secret-1234567890',
    })).toEqual([])
  })
})
