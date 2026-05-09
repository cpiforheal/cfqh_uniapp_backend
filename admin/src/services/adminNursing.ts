import { adminFetch } from './adminApi'
import type { AdminAnalytics, AdminAnalyticsStudentRow, AdminLicenseTokenRow, AdminLoginUserRow, AdminVisibility, VideoAsset } from '@/types/content'

export function queryAdminAnalytics() {
  return adminFetch<AdminAnalytics>('/admin/analytics')
}

export function queryAdminVisibility() {
  return adminFetch<AdminVisibility>('/admin/visibility')
}

export function queryAdminAssets() {
  return adminFetch<VideoAsset[]>('/admin/assets')
}

export function saveAdminAsset(asset: Partial<VideoAsset>) {
  return adminFetch<VideoAsset>('/admin/assets', {
    method: 'POST',
    body: JSON.stringify(asset),
  })
}

export function offlineAdminAsset(id: string) {
  return adminFetch<VideoAsset>(`/admin/assets/${id}`, { method: 'DELETE' })
}

export function queryAdminStudents(keyword?: string) {
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''
  return adminFetch<Array<AdminAnalyticsStudentRow & { authorization?: unknown }>>(`/admin/students${query}`)
}

export function queryAdminLoginUsers(keyword?: string) {
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''
  return adminFetch<AdminLoginUserRow[]>(`/admin/login-users${query}`)
}

export function queryAdminLicenseTokens(params: { keyword?: string; status?: string } = {}) {
  const query = new URLSearchParams()
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.status && params.status !== 'all') query.set('status', params.status)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return adminFetch<AdminLicenseTokenRow[]>(`/admin/license-tokens${suffix}`)
}

export function issueStudentLicenseToken(payload: { openId: string; expiresDays?: number }) {
  return adminFetch<{ userId: string | null; openId: string | null; reused?: boolean; unbound?: boolean; licenseToken: { id: string; code: string; expiresAt?: string | null } }>(
    '/admin/license-tokens/issue',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export function issueUnboundLicenseToken(payload: { expiresDays?: number } = {}) {
  return adminFetch<{ userId: null; openId: null; unbound: boolean; licenseToken: { id: string; code: string; expiresAt?: string | null } }>(
    '/admin/license-tokens/issue',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export function disableStudentLicenseToken(id: string) {
  return adminFetch(`/admin/license-tokens/${id}/disable`, { method: 'POST' })
}

export function deleteStudentLicenseToken(id: string) {
  return adminFetch(`/admin/license-tokens/${id}`, { method: 'DELETE' })
}

export function extendStudentLicenseToken(id: string, extendDays: number) {
  return adminFetch(`/admin/license-tokens/${id}/extend`, {
    method: 'POST',
    body: JSON.stringify({ extendDays }),
  })
}
