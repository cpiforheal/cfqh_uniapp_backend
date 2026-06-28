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

export function updateStudentRemark(userId: string, remark: string) {
  return adminFetch<{ id: string; remark: string }>(`/admin/students/${userId}/remark`, {
    method: 'POST',
    body: JSON.stringify({ remark }),
  })
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

export function queryStudentDetail(openId: string) {
  return adminFetch<Record<string, unknown>>(`/admin/students/${encodeURIComponent(openId)}`)
}

export function batchGenerateLicenseTokens(payload: { count: number; expiresDays?: number; subjectScope?: string; groupTag?: string }) {
  return adminFetch<Array<{ code: string; expiresAt?: string }>>('/admin/license-tokens/batch-generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function queryAdminTrends(days = 7) {
  return adminFetch<Array<{ date: string; practiceCount: number; correctRate: number; activeUsers: number }>>(`/admin/trends?days=${days}`)
}

export function queryAdminAlerts() {
  return adminFetch<{
    inactive: Array<{ openId: string; nickname: string; lastLoginAt: string | null }>
    expiringTokens: Array<{ code: string; boundOpenId: string | null; expiresAt: string }>
    lowAccuracyQuestions: Array<{ questionId: string; title: string; total: number; wrongRate: number }>
    activationAnomalies?: Array<{ type: string; message: string; tokenId?: string | null; openId?: string | null; count: number; lastAttemptAt?: string | null }>
  }>('/admin/alerts')
}

export function queryAdminExportStudents() {
  return adminFetch<{ rows: Array<Record<string, unknown>> }>('/admin/export/students')
}

export function queryAdminExportMistakes() {
  return adminFetch<{ rows: Array<Record<string, unknown>> }>('/admin/export/mistakes')
}

export function queryAdminGroups() {
  return adminFetch<Array<{ groupTag: string; total: number; bound: number; unused: number }>>('/admin/groups')
}

export function queryAdminAuditLogs(limit = 50) {
  return adminFetch<Array<{ id: string; action: string; target?: string; detail?: string; operator: string; createdAt: string }>>(`/admin/audit-logs?limit=${limit}`)
}

// ─── 带背管理 ─────────────────────────────────────────────────────────────────

export interface AdminStudyCardModule {
  id: string
  moduleCode: string
  moduleName: string
  sort: number
  status: string
  questionCount: number
  createdAt: string
}

export function queryAdminStudyCardModules() {
  return adminFetch<AdminStudyCardModule[]>('/admin/study-cards/modules')
}

export function deleteAdminStudyCardModule(moduleCode: string) {
  return adminFetch<{ ok: boolean }>(`/admin/study-cards/modules/${moduleCode}`, { method: 'DELETE' })
}

export function previewStudyCardImport(file: File) {
  const form = new FormData()
  form.append('file', file)
  return adminFetch<{ modules: unknown[]; totalQuestions: number; totalCards: number }>('/admin/study-cards/preview', {
    method: 'POST',
    body: form,
  })
}

export function commitStudyCardImport(data: unknown) {
  return adminFetch<{ ok: boolean; modules: unknown[] }>('/admin/study-cards/import', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── 带背手动 CRUD ───────────────────────────────────────────────────────────────

export interface AdminStudyCardQuestion {
  id: string
  seq: number
  stem: string
  type: string
  options: { key: string; text: string }[]
  answer: string
  status: string
  knowledgeCards: { id: string; seq: number; title: string; body: unknown[] }[]
}

export function createAdminStudyCardModule(data: { moduleCode: string; moduleName: string; sort?: number; status?: string }) {
  return adminFetch<AdminStudyCardModule>('/admin/study-cards/modules', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateAdminStudyCardModule(code: string, data: { moduleName?: string; sort?: number; status?: string }) {
  return adminFetch<AdminStudyCardModule>(`/admin/study-cards/modules/${code}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function queryAdminModuleQuestions(code: string) {
  return adminFetch<AdminStudyCardQuestion[]>(`/admin/study-cards/modules/${code}/questions`)
}

export function createAdminStudyCardQuestion(code: string, data: { seq?: number; stem: string; type?: string; options: { key: string; text: string }[]; answer: string }) {
  return adminFetch<AdminStudyCardQuestion>(`/admin/study-cards/modules/${code}/questions`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateAdminStudyCardQuestion(id: string, data: { seq?: number; stem?: string; type?: string; options?: { key: string; text: string }[]; answer?: string; status?: string }) {
  return adminFetch<AdminStudyCardQuestion>(`/admin/study-cards/questions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteAdminStudyCardQuestion(id: string) {
  return adminFetch<{ ok: boolean }>(`/admin/study-cards/questions/${id}`, { method: 'DELETE' })
}

export function createAdminKnowledgeCard(questionId: string, data: { title: string; body: unknown[] }) {
  return adminFetch<{ id: string; seq: number; title: string; body: unknown[] }>(`/admin/study-cards/questions/${questionId}/knowledge-cards`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateAdminKnowledgeCard(id: string, data: { title?: string; body?: unknown[] }) {
  return adminFetch<{ id: string; seq: number; title: string; body: unknown[] }>(`/admin/study-cards/knowledge-cards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteAdminKnowledgeCard(id: string) {
  return adminFetch<{ ok: boolean }>(`/admin/study-cards/knowledge-cards/${id}`, { method: 'DELETE' })
}

// ─── 带背授权码管理 ──────────────────────────────────────────────────────────────

export interface StudyCardToken {
  id: string
  code: string
  status: string
  boundOpenId: string | null
  expiresAt: string | null
  groupTag: string | null
  createdAt: string
}

export function batchGenerateStudyCardTokens(data: { count: number; expiresDays?: number; groupTag?: string }) {
  return adminFetch<{ code: string; expiresAt: string }[]>('/admin/study-cards/license-tokens/batch-generate', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function queryStudyCardTokens(keyword?: string) {
  const qs = keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''
  return adminFetch<StudyCardToken[]>(`/admin/study-cards/license-tokens${qs}`)
}

export function disableStudyCardToken(id: string) {
  return adminFetch<{ ok: boolean }>(`/admin/study-cards/license-tokens/${id}/disable`, { method: 'POST' })
}

export function extendStudyCardToken(id: string, days: number) {
  return adminFetch<{ ok: boolean; expiresAt: string }>(`/admin/study-cards/license-tokens/${id}/extend`, {
    method: 'POST',
    body: JSON.stringify({ days }),
  })
}
