import { LicenseStatus, SubjectCode } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { LicenseService } from './license.service'

describe('LicenseService authorization flow', () => {
  const openId = 'openid-user-1'
  const user = { id: 'user-1', openId, nickname: '微信用户' }
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000)

  function createPrisma(overrides: Record<string, unknown> = {}) {
    return {
      user: {
        upsert: jest.fn().mockResolvedValue(user),
        findUnique: jest.fn().mockResolvedValue({
          ...user,
          authorization: {
            subjectScope: SubjectCode.nursing,
            resourceScope: 'all',
            expiresAt: future,
            licenseToken: {
              id: 'token-1',
              code: 'NUR-ABCDEFGH',
              status: LicenseStatus.bound,
              subjectScope: SubjectCode.nursing,
              resourceScope: 'all',
              expiresAt: future,
              boundOpenId: openId,
            },
          },
        }),
      },
      licenseToken: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'token-1',
          code: 'NUR-ABCDEFGH',
          status: LicenseStatus.unused,
          subjectScope: SubjectCode.nursing,
          resourceScope: 'all',
          expiresAt: future,
          boundOpenId: null,
        }),
        update: jest.fn().mockResolvedValue({ id: 'token-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      userAuthorization: {
        upsert: jest.fn().mockResolvedValue({ id: 'authorization-1' }),
      },
      licenseActivationAttempt: {
        create: jest.fn().mockResolvedValue({ id: 'attempt-1' }),
      },
      ...overrides,
    }
  }

  function createService(prisma: unknown) {
    return new LicenseService(prisma as PrismaService)
  }

  it('activates an unused license code for the current openId', async () => {
    const prisma = createPrisma()
    const service = createService(prisma)

    const result = await service.activate({ code: 'nur-abcdefgh' }, openId)

    expect(result.authorized).toBe(true)
    expect(prisma.licenseToken.findFirst).toHaveBeenCalledWith({
      where: { code: { in: ['NUR-ABCDEFGH', 'NURABCDEFGH'] } },
    })
    expect(prisma.userAuthorization.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: user.id },
    }))
    expect(prisma.licenseToken.update).toHaveBeenCalledWith({
      where: { id: 'token-1' },
      data: expect.objectContaining({
        status: LicenseStatus.bound,
        boundUserId: user.id,
        boundOpenId: openId,
      }),
    })
    expect(prisma.licenseActivationAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        openId,
        userId: user.id,
        tokenId: 'token-1',
        result: 'success',
        reason: 'authorized',
      }),
    })
  })

  it('does not unlock when the license code does not exist', async () => {
    const prisma = createPrisma({
      licenseToken: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    })
    const service = createService(prisma)

    const result = await service.activate({ code: 'missing' }, openId)

    expect(result).toMatchObject({ authorized: false, reason: 'not_found' })
    expect(prisma.userAuthorization.upsert).not.toHaveBeenCalled()
    expect(prisma.licenseToken.update).not.toHaveBeenCalled()
    expect(prisma.licenseActivationAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        openId,
        userId: user.id,
        result: 'failed',
        reason: 'not_found',
      }),
    })
  })

  it('does not unlock when the license code is bound to another openId', async () => {
    const prisma = createPrisma({
      licenseToken: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'token-2',
          code: 'NUR-OTHERCOD',
          status: LicenseStatus.bound,
          subjectScope: SubjectCode.nursing,
          resourceScope: 'all',
          expiresAt: future,
          boundOpenId: 'other-openid',
        }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    })
    const service = createService(prisma)

    const result = await service.activate({ code: 'NUR-OTHERCOD' }, openId)

    expect(result).toMatchObject({ authorized: false, reason: 'bound_to_other_account' })
    expect(prisma.userAuthorization.upsert).not.toHaveBeenCalled()
    expect(prisma.licenseToken.update).not.toHaveBeenCalled()
    expect(prisma.licenseActivationAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        openId,
        userId: user.id,
        tokenId: 'token-2',
        result: 'failed',
        reason: 'bound_to_other_account',
      }),
    })
  })

  it('reports disabled authorization as not authorized', async () => {
    const prisma = createPrisma({
      user: {
        upsert: jest.fn().mockResolvedValue(user),
        findUnique: jest.fn().mockResolvedValue({
          ...user,
          authorization: {
            subjectScope: SubjectCode.nursing,
            expiresAt: future,
            licenseToken: {
              status: LicenseStatus.disabled,
              subjectScope: SubjectCode.nursing,
              expiresAt: future,
              boundOpenId: openId,
            },
          },
        }),
      },
    })
    const service = createService(prisma)

    const result = await service.status(openId)

    expect(result).toMatchObject({ authorized: false, reason: 'disabled' })
  })
})
