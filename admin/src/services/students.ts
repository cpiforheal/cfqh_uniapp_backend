import type { StudentRecord } from '@/types/content'

const STORAGE_KEY = 'cfqh_admin_student_records_v1'

function getTodayText() {
  return new Date().toISOString().slice(0, 10)
}

function safeParseRecords(value: string | null): StudentRecord[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getStudentRecordsFromStorage(): StudentRecord[] {
  if (typeof window === 'undefined') return []
  return safeParseRecords(window.localStorage.getItem(STORAGE_KEY))
}

export function saveStudentRecordsToStorage(records: StudentRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function createStudentRecord(input: Omit<StudentRecord, 'id' | 'updatedAt'>): StudentRecord {
  const records = getStudentRecordsFromStorage()
  const nextRecord: StudentRecord = {
    ...input,
    id: `student-${Date.now()}`,
    updatedAt: getTodayText(),
  }
  saveStudentRecordsToStorage([nextRecord, ...records])
  return nextRecord
}

export function updateStudentRecord(id: string, input: Omit<StudentRecord, 'id' | 'updatedAt'>): StudentRecord | undefined {
  const records = getStudentRecordsFromStorage()
  const nextRecord: StudentRecord = {
    ...input,
    id,
    updatedAt: getTodayText(),
  }
  const nextRecords = records.map((record) => (record.id === id ? nextRecord : record))
  saveStudentRecordsToStorage(nextRecords)
  return nextRecord
}

export function deleteStudentRecord(id: string) {
  const records = getStudentRecordsFromStorage()
  saveStudentRecordsToStorage(records.filter((record) => record.id !== id))
}

export async function queryStudentRecords() {
  return {
    data: getStudentRecordsFromStorage(),
    success: true,
  }
}
