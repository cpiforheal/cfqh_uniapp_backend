export type AdminOperationType =
  | 'problem_publish'
  | 'problem_offline'
  | 'problem_delete'
  | 'video_publish'
  | 'video_offline'
  | 'video_delete'

export interface AdminOperationLogItem {
  id: string
  type: AdminOperationType
  targetId?: string
  targetTitle?: string
  operator: string
  createdAt: string
}

const STORAGE_KEY = 'cfqh_admin_operation_logs_v1'
const MAX_LOG_COUNT = 80
const DEFAULT_OPERATOR = '老师/助教'

function safeParseLogs(value: string | null): AdminOperationLogItem[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.type && item.createdAt) : []
  } catch {
    return []
  }
}

export function getAdminOperationLogs(): AdminOperationLogItem[] {
  if (typeof window === 'undefined') return []
  return safeParseLogs(window.localStorage.getItem(STORAGE_KEY))
}

export function appendAdminOperationLog(input: Omit<AdminOperationLogItem, 'id' | 'operator' | 'createdAt'> & { operator?: string }) {
  if (typeof window === 'undefined') return

  const nextLog: AdminOperationLogItem = {
    ...input,
    id: `admin-op-${Date.now()}`,
    operator: input.operator || DEFAULT_OPERATOR,
    createdAt: new Date().toISOString(),
  }

  const logs = getAdminOperationLogs()
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([nextLog, ...logs].slice(0, MAX_LOG_COUNT)))
}
