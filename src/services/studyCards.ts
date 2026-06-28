import type { StudyCardDetail, StudyCardHomeData, StudyCardModule, StudyCardQuestionBrief } from '@/types/studyCard'
import { request } from './nursing'

export async function getStudyCardModules(): Promise<StudyCardHomeData> {
  const data = await request<StudyCardHomeData>('/study-cards/modules')
  return data ?? { modules: [], streak: 0, totalMastered: 0 }
}

export async function getModuleQuestions(moduleCode: string): Promise<StudyCardQuestionBrief[]> {
  const data = await request<StudyCardQuestionBrief[]>(`/study-cards/modules/${moduleCode}/questions`)
  return data ?? []
}

export async function getStudyCardDetail(id: string): Promise<StudyCardDetail | null> {
  return request<StudyCardDetail>(`/study-cards/questions/${id}`)
}

export async function getNextQuestionId(moduleCode: string, currentId: string): Promise<string | null> {
  const list = await getModuleQuestions(moduleCode)
  const idx = list.findIndex((q) => q.id === currentId)
  if (idx < 0 || idx >= list.length - 1) return null
  const next = list[idx + 1]
  if (next.locked) return null
  return next.id
}

export async function toggleMastery(questionId: string, mastered: boolean): Promise<void> {
  await request('/study-cards/questions/' + questionId + '/mastery', {
    method: 'POST',
    data: { mastered },
  })
}

export async function getModuleMastery(moduleCode: string): Promise<string[]> {
  const data = await request<{ mastered: string[] }>(`/study-cards/modules/${moduleCode}/mastery`)
  return data?.mastered ?? []
}

export async function getStudyCardLicenseStatus(): Promise<{ authorized: boolean; reason: string; expiresAt?: string }> {
  const data = await request<{ authorized: boolean; reason: string; expiresAt?: string }>('/license/study-card-status')
  return data ?? { authorized: false, reason: 'unknown' }
}

export async function activateStudyCardLicense(code: string): Promise<{ authorized: boolean; reason: string }> {
  const data = await request<{ authorized: boolean; reason: string }>('/license/activate-study-card', {
    method: 'POST',
    data: { code },
  })
  return data ?? { authorized: false, reason: 'unknown' }
}
