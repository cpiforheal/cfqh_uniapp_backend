type EnvMap = Record<string, string | undefined>

function isBlank(value: string | undefined) {
  return !String(value || '').trim()
}

function looksPlaceholder(value: string | undefined) {
  const normalized = String(value || '').trim().toLowerCase()
  return (
    normalized.includes('replace-with') ||
    normalized.includes('请替换') ||
    normalized.includes('your-') ||
    normalized.includes('placeholder')
  )
}

function isUnsafeSecret(value: string | undefined, devValue?: string) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return true
  if (devValue && trimmed === devValue) return true
  return trimmed.length < 16 || looksPlaceholder(trimmed)
}

export function validateProductionEnv(env: EnvMap = process.env) {
  if (env.NODE_ENV !== 'production') return []

  const errors: string[] = []
  const databaseUrl = String(env.DATABASE_URL || '').trim()

  if (isBlank(databaseUrl)) errors.push('DATABASE_URL must be configured.')
  if (/(\.\/|\/|\\)dev\.db($|\?)/.test(databaseUrl)) errors.push('DATABASE_URL must not point to dev.db in production.')
  if (env.ALLOW_DEV_OPEN_ID === 'true') errors.push('ALLOW_DEV_OPEN_ID must be false in production.')
  if (!isBlank(env.DEV_OPEN_ID)) errors.push('DEV_OPEN_ID must be empty in production.')
  if (isUnsafeSecret(env.ADMIN_TOKEN, 'cfqh-admin-dev-token')) errors.push('ADMIN_TOKEN must be a non-default secret with at least 16 characters.')
  if (isUnsafeSecret(env.GATEWAY_SECRET)) errors.push('GATEWAY_SECRET must be a non-placeholder secret with at least 16 characters.')
  if (isBlank(env.WECHAT_APP_ID) || looksPlaceholder(env.WECHAT_APP_ID)) errors.push('WECHAT_APP_ID must be configured.')
  if (isUnsafeSecret(env.WECHAT_APP_SECRET)) errors.push('WECHAT_APP_SECRET must be configured as a real server-side secret.')

  return errors
}

export function assertProductionEnv(env: EnvMap = process.env) {
  const errors = validateProductionEnv(env)
  if (errors.length > 0) {
    throw new Error(`Production environment is not ready:\n- ${errors.join('\n- ')}`)
  }
}
