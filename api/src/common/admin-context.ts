import { Injectable } from '@nestjs/common'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { AdminRole } from '@prisma/client'

export type CurrentAdminUser = {
  id: string
  username: string
  role: AdminRole
}

@Injectable()
export class AdminContextService {
  private readonly storage = new AsyncLocalStorage<CurrentAdminUser>()

  setCurrentAdmin(admin: CurrentAdminUser) {
    this.storage.enterWith(admin)
  }

  getCurrentAdmin() {
    return this.storage.getStore()
  }
}
