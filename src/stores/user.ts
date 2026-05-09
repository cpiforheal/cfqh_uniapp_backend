import { create } from 'zustand'

interface UserState {
  userId?: string
  nickname?: string
  setUser: (user: { userId: string; nickname: string }) => void
  clearUser: () => void
}

export const useUserStore = create<UserState>((set) => ({
  userId: undefined,
  nickname: undefined,
  setUser: (user) => set(user),
  clearUser: () => set({ userId: undefined, nickname: undefined }),
}))
