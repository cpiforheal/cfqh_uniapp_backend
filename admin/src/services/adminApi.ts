const API_BASE = process.env.UMI_APP_API_BASE || 'http://127.0.0.1:3001/api'
const ADMIN_TOKEN_KEY = 'cfqh_admin_token'
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

export function setAdminToken(token: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(getAdminToken() ? { 'x-admin-token': getAdminToken() } : {}),
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

export { API_BASE, DEFAULT_ADMIN_TOKEN }
