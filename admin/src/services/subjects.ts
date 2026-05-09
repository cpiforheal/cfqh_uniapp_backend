import { defaultSubjectCode, subjectOptions, type SubjectCode, type SubjectOption } from '@/constants/subjects'

const STORAGE_KEY = 'cfqh_admin_current_subject_v1'

type Listener = (subject: SubjectOption) => void

const listeners = new Set<Listener>()

export function getSubjectOption(code: SubjectCode) {
  return subjectOptions.find((subject) => subject.code === code) ?? subjectOptions[0]
}

export function getCurrentSubjectCode(): SubjectCode {
  if (typeof window === 'undefined') return defaultSubjectCode
  const stored = window.localStorage.getItem(STORAGE_KEY) as SubjectCode | null
  if (stored && subjectOptions.some((subject) => subject.code === stored)) return stored
  return defaultSubjectCode
}

export function getCurrentSubject() {
  return getSubjectOption(getCurrentSubjectCode())
}

export function setCurrentSubject(code: SubjectCode) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, code)
  }
  const subject = getSubjectOption(code)
  listeners.forEach((listener) => listener(subject))
  return subject
}

export function subscribeCurrentSubject(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
