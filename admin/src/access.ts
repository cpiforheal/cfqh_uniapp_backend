import type { AdminUser } from './services/adminAuth'

export default function access(initialState?: { currentAdmin?: AdminUser | null }) {
  return {
    canManageTeachers: initialState?.currentAdmin?.role === 'super_admin',
  }
}
