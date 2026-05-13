import { AdminRole, AdminUserStatus } from '@prisma/client'
import { AdminContextService } from '../common/admin-context'
import { PrismaService } from '../prisma/prisma.service'
import { AdminAuthService } from './admin-auth.service'

describe('AdminAuthService', () => {
  function createPrisma(initialAdmin: Record<string, unknown> | null = null) {
    let storedAdmin: Record<string, unknown> | null = initialAdmin
    return {
      adminUser: {
        count: jest.fn().mockImplementation(({ where }) => {
          if (!storedAdmin) return Promise.resolve(0)
          if (where?.role && storedAdmin.role !== where.role) return Promise.resolve(0)
          return Promise.resolve(1)
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          storedAdmin = {
            id: 'admin-user-1',
            ...data,
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          return Promise.resolve(storedAdmin)
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (!storedAdmin) return Promise.resolve(null)
          if (where.id && storedAdmin.id === where.id) return Promise.resolve(storedAdmin)
          if (where.username && storedAdmin.username === where.username) return Promise.resolve(storedAdmin)
          return Promise.resolve(null)
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          if (!storedAdmin) return Promise.resolve(null)
          const matchesId = where.id && storedAdmin.id === where.id
          const matchesUsername = where.username && storedAdmin.username === where.username
          if (!matchesId && !matchesUsername) return Promise.resolve(null)
          storedAdmin = {
            ...storedAdmin,
            ...data,
            updatedAt: new Date(),
          }
          return Promise.resolve(storedAdmin)
        }),
      },
      adminSession: {
        create: jest.fn().mockResolvedValue({ id: 'session-1' }),
      },
      adminAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: jest.fn((items: Promise<unknown>[]) => Promise.all(items)),
    }
  }

  function createService(prisma: unknown) {
    return new AdminAuthService(prisma as PrismaService, { getCurrentAdmin: () => undefined } as AdminContextService)
  }

  it('bootstraps the default super admin and creates a session on login', async () => {
    const prisma = createPrisma()
    const service = createService(prisma)

    const result = await service.login({ username: 'admin', password: '123456cfqh' }, { ip: '127.0.0.1' })

    expect(result.user).toMatchObject({
      id: 'admin-user-1',
      username: 'admin',
      role: AdminRole.super_admin,
      status: AdminUserStatus.active,
    })
    expect(result.token).toBeTruthy()
    expect(prisma.adminUser.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        username: 'admin',
        role: AdminRole.super_admin,
        status: AdminUserStatus.active,
      }),
    })
    expect(prisma.adminSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: 'admin-user-1',
      }),
    })
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin.login',
        operatorId: 'admin-user-1',
        operator: 'admin',
        ip: '127.0.0.1',
      }),
    })
  })

  it('rejects an invalid admin password without creating a session', async () => {
    const prisma = createPrisma()
    const service = createService(prisma)
    await service.login({ username: 'admin', password: '123456cfqh' })

    await expect(service.login({ username: 'admin', password: 'wrong-password' })).rejects.toThrow('后台账号或密码错误')
    expect(prisma.adminSession.create).toHaveBeenCalledTimes(1)
  })

  it('promotes an existing admin username to super admin when no super admin exists', async () => {
    const prisma = createPrisma({
      id: 'teacher-admin',
      username: 'admin',
      passwordHash: 'old-hash',
      role: AdminRole.teacher,
      status: AdminUserStatus.disabled,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const service = createService(prisma)
    const result = await service.login({ username: 'admin', password: '123456cfqh' })

    expect(result.user).toMatchObject({
      id: 'teacher-admin',
      username: 'admin',
      role: AdminRole.super_admin,
      status: AdminUserStatus.active,
    })
    expect(prisma.adminUser.update).toHaveBeenCalledWith({
      where: { id: 'teacher-admin' },
      data: expect.objectContaining({
        role: AdminRole.super_admin,
        status: AdminUserStatus.active,
      }),
    })
    expect(prisma.adminUser.create).not.toHaveBeenCalled()
  })
})
