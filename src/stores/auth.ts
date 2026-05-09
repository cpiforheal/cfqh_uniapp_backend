import Taro from '@tarojs/taro'
import { create } from 'zustand'
import type { AuthorizationStatus } from '@/types/study'

const AUTH_STORAGE_KEY = 'cfqh_auth_state'

interface PersistedAuthState {
  status: AuthorizationStatus
  tokenCode: string
  expiresAt: string
}

interface AuthState extends PersistedAuthState {
  hydrated: boolean
  setAuthorized: (tokenCode: string, expiresAt?: string) => void
  setExpiring: () => void
  logout: () => void
  hydrate: () => void
}

function readStorage(): PersistedAuthState {
  try {
    const raw = Taro.getStorageSync<string>(AUTH_STORAGE_KEY)
    if (!raw) return { status: 'unauthorized', tokenCode: '', expiresAt: '' }
    const parsed = JSON.parse(raw) as Partial<PersistedAuthState>
    return {
      status: parsed.status || 'unauthorized',
      tokenCode: parsed.tokenCode || '',
      expiresAt: parsed.expiresAt || '',
    }
  } catch {
    return { status: 'unauthorized', tokenCode: '', expiresAt: '' }
  }
}

function writeStorage(state: PersistedAuthState) {
  try {
    Taro.setStorageSync(AUTH_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unauthorized',
  tokenCode: '',
  expiresAt: '',
  hydrated: false,
  setAuthorized: (tokenCode, expiresAt) => {
    const next: PersistedAuthState = {
      status: 'authorized',
      tokenCode,
      expiresAt: expiresAt || '',
    }
    writeStorage(next)
    set({ ...next, hydrated: true })
  },
  setExpiring: () => {
    set((state) => {
      const next = { ...state, status: 'expiring' as AuthorizationStatus }
      writeStorage({ status: next.status, tokenCode: next.tokenCode, expiresAt: next.expiresAt })
      return next
    })
  },
  logout: () => {
    const next: PersistedAuthState = { status: 'unauthorized', tokenCode: '', expiresAt: '' }
    writeStorage(next)
    set({ ...next, hydrated: true })
  },
  hydrate: () => {
    set({ ...readStorage(), hydrated: true })
  },
}))
