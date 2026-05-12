import Taro from '@tarojs/taro'
import { create } from 'zustand'

const STORAGE_KEY = 'cfqh_settings'

export interface StudySettings {
  dailyGoal: number
  examDate: string
  shuffleOptions: boolean
  timerEnabled: boolean
  timerSeconds: number
  autoNext: boolean
  rankAnonymous: boolean
  restReminder: boolean
  restMinutes: number
  difficultyPreference: 'basic' | 'medium' | 'advanced' | 'auto'
  reviewFrequency: 'daily' | 'alternate' | 'exam'
}

const DEFAULT_SETTINGS: StudySettings = {
  dailyGoal: 20,
  examDate: '',
  shuffleOptions: false,
  timerEnabled: false,
  timerSeconds: 90,
  autoNext: false,
  rankAnonymous: false,
  restReminder: true,
  restMinutes: 30,
  difficultyPreference: 'auto',
  reviewFrequency: 'daily',
}

interface SettingsStore {
  settings: StudySettings
  update: (patch: Partial<StudySettings>) => void
  hydrate: () => void
}

function loadFromStorage(): StudySettings {
  try {
    const raw = Taro.getStorageSync<string>(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveToStorage(settings: StudySettings) {
  try {
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(settings))
  } catch {}
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  update: (patch) => {
    const next = { ...get().settings, ...patch }
    set({ settings: next })
    saveToStorage(next)
  },
  hydrate: () => {
    set({ settings: loadFromStorage() })
  },
}))
