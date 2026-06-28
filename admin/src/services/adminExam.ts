import { adminFetch } from './adminApi'

export interface ExamListItem {
  id: string
  title: string
  description?: string
  subjectCode: string
  durationMin: number
  totalScore: number
  maxStudents: number
  status: 'draft' | 'open' | 'grading' | 'published'
  questionCount: number
  studentCount: number
  licenseCount: number
  createdAt: string
  updatedAt: string
}

export interface ExamQuestion {
  id: string
  examId: string
  seq: number
  type: string
  stem: string
  optionsJson: string
  answer: string
  analysis?: string
  score: number
  isObjective: boolean
  createdAt: string
}

export interface ExamQuestionImportPreview {
  summary: { total: number; ready: number; needsReview: number }
  items: Array<Partial<ExamQuestion> & { issues?: string[] }>
}

export interface ExamDetail {
  id: string
  title: string
  description?: string
  subjectCode: string
  durationMin: number
  totalScore: number
  maxStudents: number
  status: string
  questions: ExamQuestion[]
  createdAt: string
}

export interface ExamLicenseItem {
  id: string
  code: string
  examId: string
  boundUserId?: string
  boundOpenId?: string
  boundAt?: string
  createdAt: string
}

export interface ExamSessionItem {
  id: string
  examId: string
  userId: string
  licenseId: string
  startedAt: string
  submittedAt?: string
  status: string
  objectiveScore?: number
  subjectiveScore?: number
  totalScore?: number
  rank?: number
  hideCount: number
  hideDurationMs: number
  user: {
    nickname?: string | null
    openId: string
    avatarUrl?: string | null
    realName?: string | null
    className?: string | null
    phoneTail?: string | null
    wechatId?: string | null
  }
}

export interface ExamSessionDetail extends ExamSessionItem {
  answers: Array<{
    id: string
    questionId: string
    answer?: string
    isCorrect?: boolean
    score?: number
    question: ExamQuestion
  }>
  comment?: { id: string; content: string } | null
}

export async function queryExams() {
  return adminFetch<ExamListItem[]>('/admin/exams')
}

export async function createExam(data: { title: string; durationMin: number; totalScore: number; description?: string; maxStudents?: number }) {
  return adminFetch<ExamListItem>('/admin/exams', { method: 'POST', body: JSON.stringify(data) })
}

export async function getExamDetail(id: string) {
  return adminFetch<ExamDetail>(`/admin/exams/${id}`)
}

export async function updateExam(id: string, data: Partial<{ title: string; durationMin: number; totalScore: number; description: string; maxStudents: number }>) {
  return adminFetch(`/admin/exams/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteExam(id: string) {
  return adminFetch(`/admin/exams/${id}`, { method: 'DELETE' })
}

export async function addExamQuestion(examId: string, data: Partial<ExamQuestion>) {
  return adminFetch<ExamQuestion>(`/admin/exams/${examId}/questions`, { method: 'POST', body: JSON.stringify(data) })
}

export async function updateExamQuestion(examId: string, questionId: string, data: Partial<ExamQuestion>) {
  return adminFetch(`/admin/exams/${examId}/questions/${questionId}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteExamQuestion(examId: string, questionId: string) {
  return adminFetch(`/admin/exams/${examId}/questions/${questionId}`, { method: 'DELETE' })
}

export async function importExamQuestions(examId: string, questions: Partial<ExamQuestion>[]) {
  return adminFetch<{ imported: number }>(`/admin/exams/${examId}/import`, { method: 'POST', body: JSON.stringify({ questions }) })
}

export async function previewExamQuestionImport(examId: string, questionDoc: File) {
  const formData = new FormData()
  formData.append('questionDoc', questionDoc)
  return adminFetch<ExamQuestionImportPreview>(`/admin/exams/${examId}/import/preview`, {
    method: 'POST',
    body: formData,
  })
}

export async function generateExamLicenses(examId: string, count: number) {
  return adminFetch<{ generated: number; codes: string[] }>(`/admin/exams/${examId}/licenses/generate`, { method: 'POST', body: JSON.stringify({ count }) })
}

export async function queryExamLicenses(examId: string) {
  return adminFetch<ExamLicenseItem[]>(`/admin/exams/${examId}/licenses`)
}

export async function openExam(id: string) {
  return adminFetch(`/admin/exams/${id}/open`, { method: 'POST' })
}

export async function closeExam(id: string) {
  return adminFetch(`/admin/exams/${id}/close`, { method: 'POST' })
}

export async function queryExamSessions(examId: string) {
  return adminFetch<ExamSessionItem[]>(`/admin/exams/${examId}/sessions`)
}

export async function createTestSubmission(examId: string) {
  return adminFetch<{ sessionId: string; openId: string; objectiveScore: number }>(`/admin/exams/${examId}/test-submission`, { method: 'POST' })
}

export async function getExamSessionDetail(examId: string, sessionId: string) {
  return adminFetch<ExamSessionDetail>(`/admin/exams/${examId}/sessions/${sessionId}`)
}

export async function gradeExamSession(examId: string, sessionId: string, data: { scores: Array<{ questionId: string; score?: number }>; comment?: string }) {
  return adminFetch(`/admin/exams/${examId}/sessions/${sessionId}/grade`, { method: 'POST', body: JSON.stringify(data) })
}

export async function publishExam(id: string) {
  return adminFetch(`/admin/exams/${id}/publish`, { method: 'POST' })
}
