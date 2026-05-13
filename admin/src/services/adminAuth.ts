import { adminFetch, clearAdminSession, setAdminSessionToken } from './adminApi'

export type AdminRole = 'super_admin' | 'teacher'
export type AdminUserStatus = 'active' | 'disabled'

export interface AdminUser {
  id: string
  username: string
  role: AdminRole
  status: AdminUserStatus
  lastLoginAt?: string | null
  createdAt: string
  updatedAt: string
}

export async function loginAdmin(payload: { username: string; password: string }) {
  const result = await adminFetch<{ token: string; expiresAt: string; user: AdminUser }>('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  setAdminSessionToken(result.token)
  return result
}

export function queryCurrentAdmin() {
  return adminFetch<AdminUser>('/admin/auth/me')
}

export async function logoutAdmin() {
  await adminFetch('/admin/auth/logout', { method: 'POST' }).catch(() => undefined)
  clearAdminSession()
}

export function queryAdminUsers() {
  return adminFetch<AdminUser[]>('/admin/auth/users')
}

export function createTeacherAccount(payload: { username: string; password: string }) {
  return adminFetch<AdminUser>('/admin/auth/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function resetTeacherPassword(id: string, password: string) {
  return adminFetch<AdminUser>(`/admin/auth/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function disableTeacherAccount(id: string) {
  return adminFetch<AdminUser>(`/admin/auth/users/${id}`, { method: 'DELETE' })
}
