import { ConfigService } from '@nestjs/config'
import { ContentStatus, LicenseStatus, SubjectCode } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { NursingService } from './nursing.service'

describe('NursingService catalog authorization', () => {
  function createService(prisma: unknown) {
    return new NursingService(prisma as PrismaService, {} as ConfigService)
  }

  it('returns only a locked course skeleton when openId is not authorized', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      question: { findMany: jest.fn() },
      videoLesson: { findMany: jest.fn() },
      practiceRecord: { findMany: jest.fn() },
    }
    const service = createService(prisma)

    const catalog = await service.catalog('unauthorized-openid')

    expect(catalog).toHaveLength(4)
    expect(catalog.every((item) => item.locked)).toBe(true)
    expect(catalog.every((item) => item.totalQuestions === 0 && item.completedQuestions === 0)).toBe(true)
    expect(catalog.every((item) => item.difficultyLabel === '待解锁')).toBe(true)
    expect(prisma.question.findMany).not.toHaveBeenCalled()
    expect(prisma.videoLesson.findMany).not.toHaveBeenCalled()
    expect(prisma.practiceRecord.findMany).not.toHaveBeenCalled()
  })

  it('returns unlocked real catalog data and progress for an authorized openId', async () => {
    const openId = 'authorized-openid'
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          openId,
          authorization: {
            subjectScope: SubjectCode.nursing,
            expiresAt: future,
            licenseToken: {
              status: LicenseStatus.bound,
              subjectScope: SubjectCode.nursing,
              expiresAt: future,
              boundOpenId: openId,
            },
          },
        }),
      },
      question: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'question-1',
            moduleCode: 'anatomy',
            moduleName: '人体解剖学',
            chapter: '运动系统',
            chapterSort: 1,
            difficulty: 'advanced',
            subjectCode: SubjectCode.nursing,
            status: ContentStatus.published,
          },
        ]),
      },
      videoLesson: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'video-1', moduleCode: 'anatomy' },
        ]),
      },
      practiceRecord: {
        findMany: jest.fn().mockResolvedValue([{ questionId: 'question-1' }]),
      },
    }
    const service = createService(prisma)

    const catalog = await service.catalog(openId)
    const anatomy = catalog.find((item) => item.moduleCode === 'anatomy')

    expect(anatomy).toMatchObject({
      locked: false,
      totalQuestions: 1,
      totalVideos: 1,
      completedQuestions: 1,
      completionRate: 100,
      difficultyLabel: '较难',
    })
    expect(prisma.practiceRecord.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { questionId: true },
    })
  })
})
