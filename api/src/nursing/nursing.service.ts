import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ContentStatus, LicenseStatus, Prisma, SubjectCode } from '@prisma/client'
import { createHmac, randomInt } from 'node:crypto'
import { stringify } from 'node:querystring'
import { AdminContextService } from '../common/admin-context'
import { PrismaService } from '../prisma/prisma.service'
import { CreateDailyPracticeDto } from './dto/create-daily-practice.dto'
import { NURSING_MODULES, getNursingModule } from './modules'
import { ParsedQuestionImportItem, previewQuestionImport } from './question-import'

type ActivationAttemptSnapshot = {
  id: string
  codeInput: string
  openId: string
  result: string
  reason: string
  tokenId?: string | null
  clientEnv?: string | null
  platform?: string | null
  device?: string | null
  ip?: string | null
  createdAt: Date
}

@Injectable()
export class NursingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly adminContext: AdminContextService,
  ) {}

  private parseOptions(optionsJson?: string | null) {
    if (!optionsJson) return []
    try {
      const options = JSON.parse(optionsJson)
      return Array.isArray(options) ? options : []
    } catch {
      return []
    }
  }

  private serializeQuestion<T extends { optionsJson?: string | null }>(question: T) {
    const { optionsJson, ...rest } = question
    return {
      ...rest,
      options: this.parseOptions(optionsJson),
    }
  }

  private resolveContentStatus(input: unknown) {
    if (input === ContentStatus.published) return ContentStatus.published
    if (input === ContentStatus.offline) return ContentStatus.offline
    return ContentStatus.draft
  }

  private hasPlaceholderValue(input: unknown) {
    return ['待补充', '待补充小章节', '未命名题目'].includes(String(input || '').trim())
  }

  private validatePublishedQuestion(dto: Record<string, unknown>, options: unknown[]) {
    const title = typeof dto.title === 'string' ? dto.title.trim() : ''
    const stem = typeof dto.stem === 'string' ? dto.stem.trim() : title
    const moduleValue = String(dto.moduleCode || dto.moduleName || '').trim()
    const chapter = typeof dto.chapter === 'string' ? dto.chapter.trim() : ''
    const answer = typeof dto.answer === 'string' ? dto.answer.trim() : ''
    const analysis = typeof dto.analysis === 'string' ? dto.analysis.trim() : ''
    const knowledgeTags = Array.isArray(dto.knowledgeTags) ? dto.knowledgeTags : typeof dto.knowledgeTags === 'string' ? dto.knowledgeTags.split(',') : []
    const type = typeof dto.type === 'string' ? dto.type : 'single_choice'
    const completeOptions = options.filter((option) => {
      const value = option as { key?: unknown; content?: unknown }
      return String(value?.key || '').trim() && String(value?.content || '').trim()
    })
    const issues: string[] = []

    if (!title || this.hasPlaceholderValue(title)) issues.push('题目标题')
    if (!stem || this.hasPlaceholderValue(stem)) issues.push('题干')
    if (!moduleValue) issues.push('一级板块')
    if (!chapter || this.hasPlaceholderValue(chapter)) issues.push('小章节')
    if (knowledgeTags.map((item) => String(item).trim()).filter(Boolean).length === 0) issues.push('知识点')
    if (!answer || this.hasPlaceholderValue(answer)) issues.push('答案')
    if (!analysis || this.hasPlaceholderValue(analysis)) issues.push('解析')
    if ((type === 'single_choice' || type === 'multiple_choice') && completeOptions.length < 2) issues.push('选项')
    if (issues.length > 0) throw new BadRequestException(`发布校验未通过：${issues.join('、')}`)
  }

  private validatePublishedVideo(dto: Record<string, unknown>) {
    const issues: string[] = []
    const knowledgeTags = Array.isArray(dto.knowledgeTags) ? dto.knowledgeTags : typeof dto.knowledgeTags === 'string' ? dto.knowledgeTags.split(',') : []
    if (!String(dto.title || '').trim()) issues.push('标题')
    if (!String(dto.moduleCode || dto.moduleName || '').trim()) issues.push('一级板块')
    if (knowledgeTags.map((item) => String(item).trim()).filter(Boolean).length === 0) issues.push('知识点')
    if (!String(dto.videoUrl || '').trim()) issues.push('videoUrl')
    if (issues.length > 0) throw new BadRequestException(`发布校验未通过：${issues.join('、')}`)
  }

  private getDifficultyLabel(difficulty: string) {
    if (difficulty === 'advanced') return '较难'
    if (difficulty === 'medium') return '中等'
    return '基础'
  }

  private getQuestionProgress(index: number, total: number) {
    return {
      current: index >= 0 ? index + 1 : 1,
      total: total || 1,
    }
  }

  private async getUserByOpenId(openId?: string) {
    if (!openId) return null
    return this.prisma.user.findUnique({ where: { openId } })
  }

  private async getAuthorizedUserByOpenId(openId?: string) {
    if (!openId) return null
    const user = await this.prisma.user.findUnique({
      where: { openId },
      include: { authorization: { include: { licenseToken: true } } },
    })
    if (!user?.authorization?.licenseToken) return null

    const now = new Date()
    const authorization = user.authorization
    const token = authorization.licenseToken
    const expired = Boolean(authorization.expiresAt && authorization.expiresAt <= now) || Boolean(token.expiresAt && token.expiresAt <= now)
    const disabled = token.status === LicenseStatus.disabled
    const subjectMatched = authorization.subjectScope === SubjectCode.nursing && token.subjectScope === SubjectCode.nursing
    const boundToCurrentUser = !token.boundOpenId || token.boundOpenId === openId
    return !expired && !disabled && subjectMatched && boundToCurrentUser ? user : null
  }

  private generateLicenseCode() {
    const seed = Math.random().toString(36).slice(2, 10).toUpperCase()
    return `NUR-${seed}`
  }

  private getEffectiveLicenseStatus(token: { status: LicenseStatus; expiresAt?: Date | null }) {
    if (token.status === LicenseStatus.disabled) return LicenseStatus.disabled
    if (token.status === LicenseStatus.expired || (token.expiresAt && token.expiresAt <= new Date())) return LicenseStatus.expired
    return token.status
  }

  private isEffectiveBoundLicense(token?: { status: LicenseStatus; expiresAt?: Date | null; boundOpenId?: string | null } | null, openId?: string) {
    if (!token) return false
    return this.getEffectiveLicenseStatus(token) === LicenseStatus.bound && (!openId || token.boundOpenId === openId)
  }

  private getActivationRisk(failedAttemptCount: number, distinctOpenIdCount: number, otherOpenIdTried = false) {
    const riskLevel = otherOpenIdTried || distinctOpenIdCount > 1
      ? 'high'
      : failedAttemptCount >= 3
        ? 'medium'
        : 'normal'
    const riskReason = riskLevel === 'high'
      ? '存在不同账号尝试'
      : riskLevel === 'medium'
        ? '失败尝试较多'
        : ''
    return { riskLevel, riskReason }
  }

  private summarizeActivationAttempts(attempts: ActivationAttemptSnapshot[], boundOpenId?: string | null) {
    const distinctOpenIds = new Set(attempts.map((attempt) => attempt.openId).filter(Boolean))
    const failedAttemptCount = attempts.filter((attempt) => attempt.result !== 'success').length
    const successAttemptCount = attempts.filter((attempt) => attempt.result === 'success').length
    const lastAttempt = attempts[0]
    const otherOpenIdTried = Boolean(boundOpenId && attempts.some((attempt) => attempt.openId && attempt.openId !== boundOpenId))
    const risk = this.getActivationRisk(failedAttemptCount, distinctOpenIds.size, otherOpenIdTried)

    return {
      attemptCount: attempts.length,
      successAttemptCount,
      failedAttemptCount,
      distinctOpenIdCount: distinctOpenIds.size,
      lastAttemptAt: lastAttempt?.createdAt ?? null,
      lastAttemptResult: lastAttempt?.result ?? null,
      lastAttemptReason: lastAttempt?.reason ?? null,
      ...risk,
    }
  }

  private async recordAdminAudit(action: string, target?: string, detail?: Record<string, unknown>) {
    const currentAdmin = this.adminContext.getCurrentAdmin()
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          action,
          target,
          detail: detail ? JSON.stringify(detail) : undefined,
          operatorId: currentAdmin?.id === 'legacy-admin' ? undefined : currentAdmin?.id,
          operator: currentAdmin?.username || 'admin',
        },
      })
    } catch (error) {
      console.warn('record admin audit log failed', error)
    }
  }

  private async disableDuplicateBoundTokens(openId: string, keepTokenId: string) {
    await this.prisma.licenseToken.updateMany({
      where: {
        boundOpenId: openId,
        status: LicenseStatus.bound,
        id: { not: keepTokenId },
      },
      data: { status: LicenseStatus.disabled },
    })
  }

  private async createLicenseToken(data: {
    status: LicenseStatus
    expiresAt?: Date | null
    boundUserId?: string
    boundOpenId?: string
    boundAt?: Date
  }) {
    for (let i = 0; i < 5; i += 1) {
      try {
        return await this.prisma.licenseToken.create({
          data: {
            code: this.generateLicenseCode(),
            status: data.status,
            subjectScope: SubjectCode.nursing,
            resourceScope: 'all',
            maxBindCount: 1,
            boundUserId: data.boundUserId,
            boundOpenId: data.boundOpenId,
            boundAt: data.boundAt,
            expiresAt: data.expiresAt,
          },
        })
      } catch {
        // retry on rare license-code collision
      }
    }
    throw new BadRequestException('授权码生成失败，请重试')
  }

  async catalog(openId?: string) {
    const authorizedUser = await this.getAuthorizedUserByOpenId(openId)
    if (!authorizedUser) {
      return NURSING_MODULES.map((module) => ({
        moduleCode: module.moduleCode,
        moduleName: module.moduleName,
        chapter: module.moduleName,
        chapterSort: module.sort,
        subChapterCount: 1,
        mockChapters: [module.mockChapter],
        totalQuestions: 0,
        totalVideos: 0,
        completedQuestions: 0,
        completionRate: 0,
        difficultyLabel: '待解锁',
        locked: true,
        iconText: module.iconText,
      }))
    }

    const [questions, videos, records] = await Promise.all([
      this.prisma.question.findMany({
        where: { subjectCode: SubjectCode.nursing, status: ContentStatus.published },
        select: { id: true, moduleCode: true, moduleName: true, chapter: true, chapterSort: true, difficulty: true },
        orderBy: [{ chapterSort: 'asc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.videoLesson.findMany({
        where: { subjectCode: SubjectCode.nursing, status: ContentStatus.published },
        select: { id: true, moduleCode: true },
      }),
      this.prisma.practiceRecord.findMany({
        where: { userId: authorizedUser.id },
        select: { questionId: true },
      }),
    ])
    const completedQuestionIds = new Set(records.map((record) => record.questionId))
    return NURSING_MODULES.map((module) => {
      const moduleQuestions = questions.filter((question) => question.moduleCode === module.moduleCode)
      const moduleVideos = videos.filter((video) => video.moduleCode === module.moduleCode)
      const completed = moduleQuestions.filter((question) => completedQuestionIds.has(question.id)).length
      const difficulties = new Set(moduleQuestions.map((question) => question.difficulty))
      const chapters = Array.from(new Set(moduleQuestions.map((question) => question.chapter).filter(Boolean)))

      return {
        moduleCode: module.moduleCode,
        moduleName: module.moduleName,
        chapter: module.moduleName,
        chapterSort: module.sort,
        subChapterCount: chapters.length,
        mockChapters: chapters.length > 0 ? chapters.slice(0, 3) : [module.mockChapter],
        totalQuestions: moduleQuestions.length,
        totalVideos: moduleVideos.length,
        completedQuestions: completed,
        completionRate: moduleQuestions.length > 0 ? Math.round((completed / moduleQuestions.length) * 100) : 0,
        difficultyLabel: Array.from(difficulties).some((difficulty) => difficulty === 'advanced')
          ? '较难'
          : Array.from(difficulties).some((difficulty) => difficulty === 'medium')
            ? '中等'
            : '基础',
        locked: false,
        iconText: module.iconText,
      }
    })
  }

  async moduleQuestions(moduleCode: string, openId?: string) {
    const [questions, user] = await Promise.all([
      this.prisma.question.findMany({
        where: { subjectCode: SubjectCode.nursing, moduleCode, status: ContentStatus.published },
        orderBy: [{ chapterSort: 'asc' }, { updatedAt: 'desc' }],
      }),
      this.getUserByOpenId(openId),
    ])

    if (!user || questions.length === 0) return questions.map((question) => this.serializeQuestion(question))

    const questionIds = questions.map((question) => question.id)
    const [records, favorites, mistakes] = await Promise.all([
      this.prisma.practiceRecord.findMany({
        where: { userId: user.id, questionId: { in: questionIds } },
        select: { questionId: true },
      }),
      this.prisma.favorite.findMany({
        where: { userId: user.id, questionId: { in: questionIds } },
        select: { questionId: true },
      }),
      this.prisma.mistake.findMany({
        where: { userId: user.id, questionId: { in: questionIds } },
        select: { questionId: true, wrongCount: true },
      }),
    ])
    const completedQuestionIds = new Set(records.map((record) => record.questionId))
    const favoriteQuestionIds = new Set(favorites.map((favorite) => favorite.questionId))
    const mistakeMap = new Map(mistakes.map((mistake) => [mistake.questionId, mistake.wrongCount]))

    return questions.map((question) => ({
      ...this.serializeQuestion(question),
      completed: completedQuestionIds.has(question.id),
      isFavorite: favoriteQuestionIds.has(question.id),
      isMistake: mistakeMap.has(question.id),
      wrongCount: mistakeMap.get(question.id) ?? 0,
    }))
  }

  async moduleVideos(moduleCode: string) {
    return this.prisma.videoLesson.findMany({
      where: { subjectCode: SubjectCode.nursing, moduleCode, status: ContentStatus.published },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async knowledgePoints() {
    return this.prisma.knowledgePoint.findMany({
      where: { subjectCode: SubjectCode.nursing, status: ContentStatus.published },
      orderBy: { sort: 'asc' },
    })
  }

  async questions(moduleCode?: string) {
    const questions = await this.prisma.question.findMany({
      where: { subjectCode: SubjectCode.nursing, status: ContentStatus.published, ...(moduleCode ? { moduleCode } : {}) },
      orderBy: [{ chapterSort: 'asc' }, { updatedAt: 'desc' }],
    })
    return questions.map((question) => this.serializeQuestion(question))
  }

  async questionDetail(id: string, openId?: string) {
    const [question, user] = await Promise.all([
      this.prisma.question.findFirst({
        where: { id, subjectCode: SubjectCode.nursing, status: ContentStatus.published },
      }),
      this.getUserByOpenId(openId),
    ])
    if (!question) throw new NotFoundException('题目不存在')

    const moduleQuestions = await this.prisma.question.findMany({
      where: { subjectCode: SubjectCode.nursing, status: ContentStatus.published, moduleCode: question.moduleCode },
      select: { id: true },
      orderBy: [{ chapterSort: 'asc' }, { updatedAt: 'desc' }],
    })

    const tags = question.knowledgeTags.split(',').map((item) => item.trim()).filter(Boolean)
    const currentIndex = moduleQuestions.findIndex((item) => item.id === question.id)
    const nextQuestionId = moduleQuestions[currentIndex + 1]?.id ?? null

    const [caseMaterial, confusingPoint, memoryTip, video, favorite, mistake] = await Promise.all([
      this.prisma.caseMaterial.findFirst({
        where: {
          subjectCode: SubjectCode.nursing,
          status: ContentStatus.published,
          OR: tags.map((tag) => ({ relatedKnowledgeTags: { contains: tag } })),
        },
      }),
      this.prisma.confusingPoint.findFirst({
        where: {
          subjectCode: SubjectCode.nursing,
          status: ContentStatus.published,
          OR: tags.flatMap((tag) => [{ leftConcept: { contains: tag } }, { rightConcept: { contains: tag } }]),
        },
      }),
      this.prisma.memoryTip.findFirst({
        where: {
          subjectCode: SubjectCode.nursing,
          status: ContentStatus.published,
          OR: tags.map((tag) => ({ relatedKnowledgeTags: { contains: tag } })),
        },
      }),
      this.prisma.videoLesson.findFirst({
        where: {
          subjectCode: SubjectCode.nursing,
          status: ContentStatus.published,
          OR: tags.map((tag) => ({ knowledgeTags: { contains: tag } })),
        },
      }),
      user
        ? this.prisma.favorite.findUnique({ where: { userId_questionId: { userId: user.id, questionId: question.id } } })
        : Promise.resolve(null),
      user
        ? this.prisma.mistake.findUnique({ where: { userId_questionId: { userId: user.id, questionId: question.id } } })
        : Promise.resolve(null),
    ])

    return {
      ...this.serializeQuestion(question),
      progress: this.getQuestionProgress(currentIndex, moduleQuestions.length),
      nextQuestionId,
      isFavorite: Boolean(favorite),
      inMistakeBook: Boolean(mistake),
      wrongCount: mistake?.wrongCount ?? 0,
      caseMaterial,
      confusingPoint,
      memoryTip,
      relatedVideo: video,
    }
  }

  async caseMaterials() {
    return this.prisma.caseMaterial.findMany({
      where: { subjectCode: SubjectCode.nursing, status: ContentStatus.published },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async confusingPoints() {
    return this.prisma.confusingPoint.findMany({
      where: { subjectCode: SubjectCode.nursing, status: ContentStatus.published },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async memoryTips() {
    return this.prisma.memoryTip.findMany({
      where: { subjectCode: SubjectCode.nursing, status: ContentStatus.published },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async dailyPractice() {
    return this.prisma.dailyPractice.findMany({
      where: { subjectCode: SubjectCode.nursing, status: ContentStatus.published, date: { lte: new Date() } },
      orderBy: [{ date: 'desc' }, { updatedAt: 'desc' }],
      take: 1,
    })
  }

  async practiceHome(openId?: string) {
    const [dailyPractice, videos, confusingPoints, memoryTips, questions, authorizedUser] = await Promise.all([
      this.dailyPractice(),
      this.videos(),
      this.confusingPoints(),
      this.memoryTips(),
      this.prisma.question.findMany({
        where: { subjectCode: SubjectCode.nursing, status: ContentStatus.published },
        orderBy: [{ chapterSort: 'asc' }, { updatedAt: 'desc' }],
      }),
      this.getAuthorizedUserByOpenId(openId),
    ])
    const user = authorizedUser

    const [records, mistakes] = user
      ? await Promise.all([
          this.prisma.practiceRecord.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
          this.prisma.mistake.findMany({ where: { userId: user.id, mastered: false }, orderBy: { wrongCount: 'desc' } }),
        ])
      : [[], []]
    const daily = dailyPractice[0] ?? null
    const firstPublishedQuestion = questions[0] ?? null
    const dailyQuestion = daily
      ? questions.find((question) => question.id === daily.questionId) ?? firstPublishedQuestion
      : firstPublishedQuestion
    const continueQuestion = records[0]
      ? questions.find((question) => question.id === records[0].questionId) ?? dailyQuestion
      : dailyQuestion
    const recentMistakes = mistakes
      .map((mistake) => {
        const question = questions.find((item) => item.id === mistake.questionId)
        return question ? { ...question, wrongCount: mistake.wrongCount } : null
      })
      .filter((question): question is NonNullable<typeof question> => Boolean(question))
    const recommendationSeeds = (() => {
      const chapterWeights = new Map<string, number>()
      for (const m of mistakes) {
        const q = questions.find((item) => item.id === m.questionId)
        if (q?.chapter) chapterWeights.set(q.chapter, (chapterWeights.get(q.chapter) || 0) + m.wrongCount)
      }
      const doneIds = new Set(records.map((r) => r.questionId))
      const undone = questions.filter((q) => !doneIds.has(q.id) && q.id !== continueQuestion?.id && q.id !== dailyQuestion?.id)
      undone.sort((a, b) => (chapterWeights.get(b.chapter) || 0) - (chapterWeights.get(a.chapter) || 0))
      return [dailyQuestion, ...undone].filter((q): q is NonNullable<typeof q> => Boolean(q))
    })()
    const progressDone = new Set(records.map((record) => record.questionId)).size
    const progressTotal = questions.length
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)
    const practiceDaySet = new Set(
      records
        .filter((record) => record.createdAt >= sevenDaysAgo)
        .map((record) => record.createdAt.toISOString().slice(0, 10)),
    )

    return {
      subjectCode: 'nursing',
      subjectName: '医护大类',
      authorization: authorizedUser ? { status: 'authorized' } : { status: 'unauthorized' },
      progress: {
        done: progressDone,
        total: progressTotal,
        percent: progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0,
      },
      weeklyCompletedCount: practiceDaySet.size,
      continueQuestion: continueQuestion ? this.serializeQuestion(continueQuestion) : null,
      dailyPractice: daily,
      dailyQuestion: dailyQuestion ? this.serializeQuestion(dailyQuestion) : null,
      recommendedQuestions: recommendationSeeds.slice(0, 5).map((question) => this.serializeQuestion(question)),
      recentMistakes: recentMistakes.slice(0, 5).map((question) => this.serializeQuestion(question)),
      recommendedVideos: videos.slice(0, 2),
      confusingPoints: confusingPoints.slice(0, 3),
      memoryTips: memoryTips.slice(0, 3),
    }
  }

  async videos(moduleCode?: string) {
    return this.prisma.videoLesson.findMany({
      where: { subjectCode: SubjectCode.nursing, status: ContentStatus.published, ...(moduleCode ? { moduleCode } : {}) },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async adminAnalytics() {
    const [users, authorizations, records, mistakes, questions] = await Promise.all([
      this.prisma.user.findMany({
        select: {
          id: true,
          openId: true,
          nickname: true,
          avatarUrl: true,
          createdAt: true,
          loginCount: true,
          lastLoginAt: true,
          lastClientEnv: true,
          lastPlatform: true,
          lastDevice: true,
          lastSdkVersion: true,
        },
      }),
      this.prisma.userAuthorization.findMany({
        select: {
          userId: true,
          activatedAt: true,
          expiresAt: true,
          licenseToken: {
            select: {
              code: true,
              status: true,
              createdAt: true,
              boundAt: true,
              expiresAt: true,
            },
          },
        },
      }),
      this.prisma.practiceRecord.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.mistake.findMany(),
      this.prisma.question.findMany({ where: { subjectCode: SubjectCode.nursing }, select: { id: true, title: true, moduleCode: true, moduleName: true, knowledgeTags: true } }),
    ])

    const questionMap = new Map(questions.map((question) => [question.id, question]))
    const authMap = new Map(authorizations.map((authorization) => [authorization.userId, authorization]))
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const uniquePracticeDays = new Set(records.map((record) => record.createdAt.toISOString().slice(0, 10)))
    const activeStudentIds = new Set(records.filter((record) => record.createdAt >= sevenDaysAgo).map((record) => record.userId))
    const totalRecords = records.length
    const correctRecords = records.filter((record) => record.isCorrect).length

    const moduleMap = new Map<string, { moduleCode: string; moduleName: string; total: number; correct: number }>()
    const questionStatsMap = new Map<string, { questionId: string; title: string; total: number; correct: number; wrong: number }>()

    for (const record of records) {
      const question = questionMap.get(record.questionId)
      const moduleCode = question?.moduleCode || 'unknown'
      const moduleName = question?.moduleName || '未归属模块'
      const moduleStat = moduleMap.get(moduleCode) ?? { moduleCode, moduleName, total: 0, correct: 0 }
      moduleStat.total += 1
      if (record.isCorrect) moduleStat.correct += 1
      moduleMap.set(moduleCode, moduleStat)

      const questionStat = questionStatsMap.get(record.questionId) ?? {
        questionId: record.questionId,
        title: question?.title || record.questionId,
        total: 0,
        correct: 0,
        wrong: 0,
      }
      questionStat.total += 1
      if (record.isCorrect) questionStat.correct += 1
      else questionStat.wrong += 1
      questionStatsMap.set(record.questionId, questionStat)
    }

    const studentRows = users.map((user) => {
      const userRecords = records.filter((record) => record.userId === user.id)
      const userMistakes = mistakes.filter((mistake) => mistake.userId === user.id)
      const practiceDays = new Set(userRecords.map((record) => record.createdAt.toISOString().slice(0, 10))).size
      const correct = userRecords.filter((record) => record.isCorrect).length
      const recentDays = new Set(userRecords.filter((record) => record.createdAt >= sevenDaysAgo).map((record) => record.createdAt.toISOString().slice(0, 10))).size
      const authorization = authMap.get(user.id)

      return {
        userId: user.id,
        openId: user.openId,
        nickname: user.nickname || '微信用户',
        avatarUrl: user.avatarUrl || null,
        practiceCount: userRecords.length,
        correctRate: userRecords.length > 0 ? Math.round((correct / userRecords.length) * 100) : 0,
        mistakeCount: userMistakes.reduce((sum, mistake) => sum + mistake.wrongCount, 0),
        practiceDays,
        recentPracticeDays: recentDays,
        loginCount: user.loginCount,
        lastLoginAt: user.lastLoginAt,
        lastClientEnv: user.lastClientEnv,
        lastPlatform: user.lastPlatform,
        lastDevice: user.lastDevice,
        lastSdkVersion: user.lastSdkVersion,
        activatedAt: authorization?.activatedAt ?? null,
        expiresAt: authorization?.expiresAt ?? null,
        licenseCode: authorization?.licenseToken?.code ?? null,
        licenseIssuedAt: authorization?.licenseToken?.createdAt ?? null,
        licenseBoundAt: authorization?.licenseToken?.boundAt ?? null,
        licenseExpiresAt: authorization?.licenseToken?.expiresAt ?? authorization?.expiresAt ?? null,
        licenseStatus: authorization?.licenseToken?.status ?? null,
      }
    })

    return {
      overview: {
        totalStudents: users.length,
        authorizedStudents: authorizations.length,
        activeStudents7d: activeStudentIds.size,
        totalPracticeRecords: totalRecords,
        overallCorrectRate: totalRecords > 0 ? Math.round((correctRecords / totalRecords) * 100) : 0,
        practiceDays: uniquePracticeDays.size,
        totalMistakes: mistakes.reduce((sum, mistake) => sum + mistake.wrongCount, 0),
      },
      moduleStats: Array.from(moduleMap.values()).map((item) => ({
        ...item,
        correctRate: item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0,
      })),
      questionStats: Array.from(questionStatsMap.values())
        .map((item) => ({ ...item, correctRate: item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0 }))
        .sort((a, b) => b.wrong - a.wrong)
        .slice(0, 10),
      students: studentRows.sort((a, b) => b.practiceCount - a.practiceCount),
    }
  }

  async adminVisibility() {
    const [questions, videos, rawAssets] = await Promise.all([
      this.prisma.question.findMany({ where: { subjectCode: SubjectCode.nursing } }),
      this.prisma.videoLesson.findMany({ where: { subjectCode: SubjectCode.nursing } }),
      (this.prisma as any).videoAsset?.findMany?.({ where: { subjectCode: SubjectCode.nursing } }) ?? Promise.resolve([]),
    ])
    const assets = rawAssets as Array<{ status: ContentStatus }>

    return {
      modules: NURSING_MODULES.map((module) => {
        const moduleQuestions = questions.filter((question) => question.moduleCode === module.moduleCode)
        const moduleVideos = videos.filter((video) => video.moduleCode === module.moduleCode)
        const latestQuestion = moduleQuestions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
        const latestVideo = moduleVideos.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]

        return {
          moduleCode: module.moduleCode,
          moduleName: module.moduleName,
          publishedQuestions: moduleQuestions.filter((question) => question.status === ContentStatus.published).length,
          draftQuestions: moduleQuestions.filter((question) => question.status === ContentStatus.draft).length,
          offlineQuestions: moduleQuestions.filter((question) => question.status === ContentStatus.offline).length,
          publishedVideos: moduleVideos.filter((video) => video.status === ContentStatus.published).length,
          draftVideos: moduleVideos.filter((video) => video.status === ContentStatus.draft).length,
          offlineVideos: moduleVideos.filter((video) => video.status === ContentStatus.offline).length,
          latestQuestionAt: latestQuestion?.updatedAt ?? null,
          latestVideoAt: latestVideo?.updatedAt ?? null,
        }
      }),
      assets: {
        total: assets.length,
        published: assets.filter((asset) => asset.status === ContentStatus.published).length,
        draft: assets.filter((asset) => asset.status === ContentStatus.draft).length,
        offline: assets.filter((asset) => asset.status === ContentStatus.offline).length,
      },
    }
  }

  async adminAssets() {
    const videoAsset = (this.prisma as any).videoAsset
    if (!videoAsset?.findMany) return []
    return videoAsset.findMany({ where: { subjectCode: SubjectCode.nursing }, orderBy: { updatedAt: 'desc' } })
  }

  async upsertAdminAsset(dto: Record<string, unknown>) {
    const videoAsset = (this.prisma as any).videoAsset
    if (!videoAsset?.upsert || !videoAsset?.create) return null
    const id = typeof dto.id === 'string' && dto.id ? dto.id : undefined
    const filename = typeof dto.filename === 'string' && dto.filename ? dto.filename : '未命名素材.mp4'
    const fileKey = typeof dto.fileKey === 'string' && dto.fileKey ? dto.fileKey : `local/video/${Date.now()}-${filename}`
    const sizeMB = typeof dto.sizeMB === 'number' ? dto.sizeMB : Number(dto.sizeMB || 0) || 0
    const status = this.resolveContentStatus(dto.status)
    const data = {
      subjectCode: SubjectCode.nursing,
      filename,
      fileKey,
      sizeMB,
      source: typeof dto.source === 'string' && dto.source ? dto.source : 'local',
      downloadUrl: typeof dto.downloadUrl === 'string' ? dto.downloadUrl : typeof dto.fileKey === 'string' ? dto.fileKey : undefined,
      status,
    }

    if (id) {
      const saved = await videoAsset.upsert({ where: { id }, update: data, create: { id, ...data } })
      await this.recordAdminAudit('asset.upsert', id, { filename, status })
      return saved
    }

    const created = await videoAsset.create({ data })
    await this.recordAdminAudit('asset.create', created?.id, { filename, status })
    return created
  }

  async deleteAdminAsset(id: string) {
    const videoAsset = (this.prisma as any).videoAsset
    if (!videoAsset?.update) return null
    const updated = await videoAsset.update({ where: { id }, data: { status: ContentStatus.offline } })
    await this.recordAdminAudit('asset.offline', id, { filename: updated?.filename })
    return updated
  }

  async adminStudents(keyword?: string) {
    const users = await this.prisma.user.findMany({
      where: keyword
        ? {
            OR: [
              { openId: { contains: keyword } },
              { nickname: { contains: keyword } },
            ],
          }
        : undefined,
      include: {
        authorization: {
          include: {
            licenseToken: true,
          },
        },
      },
      orderBy: [{ lastLoginAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    })

    return users.map((user) => ({
      userId: user.id,
      openId: user.openId,
      nickname: user.nickname || '微信用户',
      avatarUrl: user.avatarUrl,
      loginCount: user.loginCount,
      lastLoginAt: user.lastLoginAt,
      lastClientEnv: user.lastClientEnv,
      lastPlatform: user.lastPlatform,
      lastDevice: user.lastDevice,
      lastSdkVersion: user.lastSdkVersion,
      createdAt: user.createdAt,
      authorization: user.authorization
        ? {
            activatedAt: user.authorization.activatedAt,
            expiresAt: user.authorization.expiresAt,
            licenseToken: user.authorization.licenseToken
              ? {
                  id: user.authorization.licenseToken.id,
                  code: user.authorization.licenseToken.code,
                  status: user.authorization.licenseToken.status,
                  createdAt: user.authorization.licenseToken.createdAt,
                  boundAt: user.authorization.licenseToken.boundAt,
                  expiresAt: user.authorization.licenseToken.expiresAt,
                }
              : null,
          }
        : null,
    }))
  }

  async adminLoginUsers(keyword?: string) {
    const normalizedKeyword = String(keyword || '').trim()
    const users = await this.prisma.user.findMany({
      where: normalizedKeyword
        ? {
            OR: [
              { openId: { contains: normalizedKeyword } },
              { nickname: { contains: normalizedKeyword } },
              { lastDevice: { contains: normalizedKeyword } },
            ],
          }
        : undefined,
      include: {
        authorization: {
          include: { licenseToken: true },
        },
        loginLogs: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: [{ lastLoginAt: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    })
    const userIds = users.map((user) => user.id)
    const openIds = users.map((user) => user.openId)
    const [
      practiceGroups,
      correctGroups,
      mistakeGroups,
      favoriteGroups,
      activationAttemptGroups,
      recentActivationAttempts,
    ] = userIds.length > 0
      ? await Promise.all([
          this.prisma.practiceRecord.groupBy({
            by: ['userId'],
            where: { userId: { in: userIds } },
            _count: { id: true },
            _min: { createdAt: true },
            _max: { createdAt: true },
          }),
          this.prisma.practiceRecord.groupBy({
            by: ['userId', 'isCorrect'],
            where: { userId: { in: userIds } },
            _count: { id: true },
          }),
          this.prisma.mistake.groupBy({
            by: ['userId'],
            where: { userId: { in: userIds } },
            _sum: { wrongCount: true },
          }),
          this.prisma.favorite.groupBy({
            by: ['userId'],
            where: { userId: { in: userIds } },
            _count: { id: true },
          }),
          this.prisma.licenseActivationAttempt.groupBy({
            by: ['openId', 'result'],
            where: { openId: { in: openIds } },
            _count: { id: true },
          }),
          this.prisma.licenseActivationAttempt.findMany({
            where: { openId: { in: openIds } },
            select: {
              id: true,
              codeInput: true,
              openId: true,
              result: true,
              reason: true,
              tokenId: true,
              clientEnv: true,
              platform: true,
              device: true,
              ip: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: Math.min(Math.max(openIds.length * 5, 100), 1500),
          }),
        ])
      : [[], [], [], [], [], []]
    const practiceByUser = new Map(practiceGroups.map((group) => [group.userId, group]))
    const correctByUser = new Map(
      correctGroups
        .filter((group) => group.isCorrect)
        .map((group) => [group.userId, group._count.id]),
    )
    const mistakeByUser = new Map(mistakeGroups.map((group) => [group.userId, group._sum.wrongCount || 0]))
    const favoriteByUser = new Map(favoriteGroups.map((group) => [group.userId, group._count.id]))
    const activationCountByOpenId = new Map<string, { attemptCount: number; successAttemptCount: number; failedAttemptCount: number }>()
    for (const group of activationAttemptGroups) {
      const summary = activationCountByOpenId.get(group.openId) || { attemptCount: 0, successAttemptCount: 0, failedAttemptCount: 0 }
      summary.attemptCount += group._count.id
      if (group.result === 'success') summary.successAttemptCount += group._count.id
      else summary.failedAttemptCount += group._count.id
      activationCountByOpenId.set(group.openId, summary)
    }
    const attemptsByOpenId = new Map<string, ActivationAttemptSnapshot[]>()
    for (const attempt of recentActivationAttempts) {
      const attempts = attemptsByOpenId.get(attempt.openId) || []
      if (attempts.length < 5) attempts.push(attempt)
      attemptsByOpenId.set(attempt.openId, attempts)
    }

    return users.map((user) => {
      const activationSummary = this.summarizeActivationAttempts(attemptsByOpenId.get(user.openId) || [], user.authorization?.licenseToken?.boundOpenId)
      const activationCounts = activationCountByOpenId.get(user.openId)
      const failedAttemptCount = activationCounts?.failedAttemptCount ?? activationSummary.failedAttemptCount
      const aggregateRisk = this.getActivationRisk(failedAttemptCount, activationCounts ? 1 : activationSummary.distinctOpenIdCount)
      return {
        userId: user.id,
        openId: user.openId,
        nickname: user.nickname || '微信用户',
        avatarUrl: user.avatarUrl,
        loginCount: user.loginCount,
        firstLoginAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        lastClientEnv: user.lastClientEnv,
        lastPlatform: user.lastPlatform,
        lastDevice: user.lastDevice,
        lastSdkVersion: user.lastSdkVersion,
        authorization: user.authorization
          ? {
              activatedAt: user.authorization.activatedAt,
              expiresAt: user.authorization.expiresAt,
              licenseToken: user.authorization.licenseToken
                ? {
                    id: user.authorization.licenseToken.id,
                    code: user.authorization.licenseToken.code,
                    status: this.getEffectiveLicenseStatus(user.authorization.licenseToken),
                    boundAt: user.authorization.licenseToken.boundAt,
                    expiresAt: user.authorization.licenseToken.expiresAt,
                  }
                : null,
            }
          : null,
        practiceSummary: {
          practiceCount: practiceByUser.get(user.id)?._count.id || 0,
          correctRate: practiceByUser.get(user.id)?._count.id
            ? Math.round(((correctByUser.get(user.id) || 0) / practiceByUser.get(user.id)!._count.id) * 100)
            : 0,
          mistakeCount: mistakeByUser.get(user.id) || 0,
          favoriteCount: favoriteByUser.get(user.id) || 0,
          firstPracticeAt: practiceByUser.get(user.id)?._min.createdAt ?? null,
          lastPracticeAt: practiceByUser.get(user.id)?._max.createdAt ?? null,
        },
        activationAttemptSummary: {
          ...activationSummary,
          attemptCount: activationCounts?.attemptCount ?? activationSummary.attemptCount,
          successAttemptCount: activationCounts?.successAttemptCount ?? activationSummary.successAttemptCount,
          failedAttemptCount,
          distinctOpenIdCount: activationCounts ? 1 : activationSummary.distinctOpenIdCount,
          ...aggregateRisk,
        },
        recentActivationAttempts: (attemptsByOpenId.get(user.openId) || []).map((attempt) => ({
          id: attempt.id,
          codeInput: attempt.codeInput,
          result: attempt.result,
          reason: attempt.reason,
          clientEnv: attempt.clientEnv,
          platform: attempt.platform,
          device: attempt.device,
          ip: attempt.ip,
          createdAt: attempt.createdAt,
        })),
        recentLogs: user.loginLogs.map((log) => ({
          id: log.id,
          clientEnv: log.clientEnv,
          platform: log.platform,
          device: log.device,
          sdkVersion: log.sdkVersion,
          appVersion: log.appVersion,
          source: log.source,
          ip: log.ip,
          userAgent: log.userAgent,
          createdAt: log.createdAt,
        })),
      }
    })
  }

  async adminLicenseTokens(keyword?: string, status?: string) {
    const normalizedKeyword = String(keyword || '').trim()
    const normalizedStatus = String(status || '').trim()
    const statusFilter = Object.values(LicenseStatus).includes(normalizedStatus as LicenseStatus)
      ? (normalizedStatus as LicenseStatus)
      : undefined
    const now = new Date()
    const filters: Prisma.LicenseTokenWhereInput[] = []
    if (statusFilter === LicenseStatus.expired) {
      filters.push({ OR: [{ status: LicenseStatus.expired }, { expiresAt: { lte: now }, status: { not: LicenseStatus.disabled } }] })
    } else if (statusFilter) {
      filters.push({
        status: statusFilter,
        ...(statusFilter !== LicenseStatus.disabled ? { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } : {}),
      })
    }
    if (normalizedKeyword) {
      filters.push({
        OR: [
          { code: { contains: normalizedKeyword.toUpperCase() } },
          { boundOpenId: { contains: normalizedKeyword } },
          { boundUserId: { contains: normalizedKeyword } },
        ],
      })
    }
    const tokens = await this.prisma.licenseToken.findMany({
      where: filters.length > 0 ? { AND: filters } : {},
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    const userIds = Array.from(new Set(tokens.map((token) => token.boundUserId).filter(Boolean))) as string[]
    const users = userIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, openId: true, nickname: true, avatarUrl: true },
        })
      : []
    const userById = new Map(users.map((user) => [user.id, user]))
    const tokenIds = tokens.map((token) => token.id)
    const [activationAttemptGroups, activationOpenIdGroups, activationAttempts] = tokenIds.length > 0
      ? await Promise.all([
          this.prisma.licenseActivationAttempt.groupBy({
            by: ['tokenId', 'result'],
            where: { tokenId: { in: tokenIds } },
            _count: { id: true },
          }),
          this.prisma.licenseActivationAttempt.groupBy({
            by: ['tokenId', 'openId'],
            where: { tokenId: { in: tokenIds } },
            _count: { id: true },
          }),
          this.prisma.licenseActivationAttempt.findMany({
            where: { tokenId: { in: tokenIds } },
            select: {
              id: true,
              codeInput: true,
              openId: true,
              result: true,
              reason: true,
              tokenId: true,
              clientEnv: true,
              platform: true,
              device: true,
              ip: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: Math.min(Math.max(tokenIds.length * 5, 200), 2500),
          }),
        ])
      : [[], [], []]
    const activationCountByTokenId = new Map<string, { attemptCount: number; successAttemptCount: number; failedAttemptCount: number }>()
    for (const group of activationAttemptGroups) {
      if (!group.tokenId) continue
      const summary = activationCountByTokenId.get(group.tokenId) || { attemptCount: 0, successAttemptCount: 0, failedAttemptCount: 0 }
      summary.attemptCount += group._count.id
      if (group.result === 'success') summary.successAttemptCount += group._count.id
      else summary.failedAttemptCount += group._count.id
      activationCountByTokenId.set(group.tokenId, summary)
    }
    const activationOpenIdsByTokenId = new Map<string, Set<string>>()
    for (const group of activationOpenIdGroups) {
      if (!group.tokenId) continue
      const openIdsForToken = activationOpenIdsByTokenId.get(group.tokenId) || new Set<string>()
      if (group.openId) openIdsForToken.add(group.openId)
      activationOpenIdsByTokenId.set(group.tokenId, openIdsForToken)
    }
    const attemptsByTokenId = new Map<string, ActivationAttemptSnapshot[]>()
    for (const attempt of activationAttempts) {
      if (!attempt.tokenId) continue
      const attempts = attemptsByTokenId.get(attempt.tokenId) || []
      if (attempts.length < 10) attempts.push(attempt)
      attemptsByTokenId.set(attempt.tokenId, attempts)
    }

    const rows = tokens.map((token) => {
      const tokenAttempts = attemptsByTokenId.get(token.id) || []
      const activationSummary = this.summarizeActivationAttempts(tokenAttempts, token.boundOpenId)
      const activationCounts = activationCountByTokenId.get(token.id)
      const openIdsForToken = activationOpenIdsByTokenId.get(token.id)
      const distinctOpenIdCount = openIdsForToken?.size ?? activationSummary.distinctOpenIdCount
      const failedAttemptCount = activationCounts?.failedAttemptCount ?? activationSummary.failedAttemptCount
      const otherOpenIdTried = Boolean(token.boundOpenId && Array.from(openIdsForToken || []).some((openId) => openId !== token.boundOpenId))
      const aggregateRisk = this.getActivationRisk(failedAttemptCount, distinctOpenIdCount, otherOpenIdTried)
      return {
        id: token.id,
        code: token.code,
        status: this.getEffectiveLicenseStatus(token),
        subjectScope: token.subjectScope,
        resourceScope: token.resourceScope,
        maxBindCount: token.maxBindCount,
        boundUserId: token.boundUserId,
        boundOpenId: token.boundOpenId,
        boundAt: token.boundAt,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
        user: token.boundUserId ? userById.get(token.boundUserId) || null : null,
        activationAttemptSummary: {
          ...activationSummary,
          attemptCount: activationCounts?.attemptCount ?? activationSummary.attemptCount,
          successAttemptCount: activationCounts?.successAttemptCount ?? activationSummary.successAttemptCount,
          failedAttemptCount,
          distinctOpenIdCount,
          ...aggregateRisk,
        },
        recentActivationAttempts: tokenAttempts.slice(0, 5).map((attempt) => ({
          id: attempt.id,
          codeInput: attempt.codeInput,
          openId: attempt.openId,
          result: attempt.result,
          reason: attempt.reason,
          clientEnv: attempt.clientEnv,
          platform: attempt.platform,
          device: attempt.device,
          ip: attempt.ip,
          createdAt: attempt.createdAt,
        })),
      }
    })

    return normalizedStatus === 'risk'
      ? rows.filter((row) => row.activationAttemptSummary.riskLevel !== 'normal')
      : rows
  }

  async issueLicenseToken(dto: Record<string, unknown>) {
    const openId = typeof dto.openId === 'string' ? dto.openId.trim() : ''
    const expiresDays = typeof dto.expiresDays === 'number' ? dto.expiresDays : Number(dto.expiresDays || 0)
    const expiresAt = expiresDays > 0 ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000) : null

    if (!openId) {
      const created = await this.createLicenseToken({
        status: LicenseStatus.unused,
        expiresAt,
      })
      await this.recordAdminAudit('license.issue_unbound', created.id, { code: created.code, expiresAt })
      return {
        userId: null,
        openId: null,
        licenseToken: created,
        unbound: true,
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { openId },
      include: { authorization: { include: { licenseToken: true } } },
    })
    if (!user) throw new NotFoundException('该微信用户不存在，请先登录小程序')

    const currentToken = user.authorization?.licenseToken

    if (currentToken && this.isEffectiveBoundLicense(currentToken, user.openId)) {
      await this.disableDuplicateBoundTokens(user.openId, currentToken.id)
      await this.recordAdminAudit('license.reuse_existing', currentToken.id, { openId: user.openId })
      return {
        userId: user.id,
        openId: user.openId,
        licenseToken: currentToken,
        reused: true,
      }
    }

    const created = await this.createLicenseToken({
      status: LicenseStatus.bound,
      boundUserId: user.id,
      boundOpenId: user.openId,
      boundAt: new Date(),
      expiresAt,
    })
    await this.disableDuplicateBoundTokens(user.openId, created.id)

    await this.prisma.userAuthorization.upsert({
      where: { userId: user.id },
      update: {
        licenseTokenId: created.id,
        subjectScope: SubjectCode.nursing,
        resourceScope: 'all',
        expiresAt,
      },
      create: {
        userId: user.id,
        licenseTokenId: created.id,
        subjectScope: SubjectCode.nursing,
        resourceScope: 'all',
        expiresAt,
      },
    })

    await this.recordAdminAudit('license.issue_bound', created.id, { openId: user.openId, expiresAt })
    return {
      userId: user.id,
      openId: user.openId,
      licenseToken: created,
    }
  }

  async disableLicenseToken(id: string) {
    const updated = await this.prisma.licenseToken.update({
      where: { id },
      data: { status: LicenseStatus.disabled },
    })
    await this.recordAdminAudit('license.disable', id, { code: updated.code, boundOpenId: updated.boundOpenId })
    return updated
  }

  async deleteLicenseToken(id: string) {
    const token = await this.prisma.licenseToken.findUnique({
      where: { id },
      include: { authorization: { select: { id: true } } },
    })
    if (!token) throw new NotFoundException('授权码不存在')
    if (token.authorization.length > 0) throw new BadRequestException('该授权码仍关联账号授权，请先禁用或更换该账号授权后再删除')
    if (this.getEffectiveLicenseStatus(token) === LicenseStatus.bound) throw new BadRequestException('已绑定且仍有效的授权码不能直接删除')

    const deleted = await this.prisma.licenseToken.delete({ where: { id } })
    await this.recordAdminAudit('license.delete', id, { code: deleted.code, status: deleted.status })
    return deleted
  }

  async extendLicenseToken(id: string, dto: Record<string, unknown>) {
    const extendDays = typeof dto.extendDays === 'number' ? dto.extendDays : Number(dto.extendDays || 0)
    if (!extendDays || extendDays <= 0) {
      throw new BadRequestException('extendDays 必须大于 0')
    }

    const token = await this.prisma.licenseToken.findUnique({ where: { id } })
    if (!token) throw new NotFoundException('授权码不存在')

    const base = token.expiresAt && token.expiresAt > new Date() ? token.expiresAt : new Date()
    const nextExpiresAt = new Date(base.getTime() + extendDays * 24 * 60 * 60 * 1000)

    const updated = await this.prisma.licenseToken.update({
      where: { id },
      data: {
        expiresAt: nextExpiresAt,
        status: token.status === LicenseStatus.expired ? LicenseStatus.bound : token.status,
      },
    })
    await this.recordAdminAudit('license.extend', id, { code: updated.code, extendDays, expiresAt: nextExpiresAt })
    return updated
  }

  async adminQuestions() {
    return this.prisma.question.findMany({
      where: { subjectCode: SubjectCode.nursing },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async adminVideos() {
    return this.prisma.videoLesson.findMany({
      where: { subjectCode: SubjectCode.nursing },
      orderBy: { updatedAt: 'desc' },
    })
  }

  createVodUploadSignature() {
    const secretId = this.configService.get<string>('TENCENT_SECRET_ID') || this.configService.get<string>('TENCENTCLOUD_SECRET_ID')
    const secretKey = this.configService.get<string>('TENCENT_SECRET_KEY') || this.configService.get<string>('TENCENTCLOUD_SECRET_KEY')
    if (!secretId || !secretKey) {
      throw new BadRequestException('VOD 上传签名缺少 TENCENT_SECRET_ID/TENCENT_SECRET_KEY，请在 api/.env 配置后重启服务')
    }

    const currentTimeStamp = Math.floor(Date.now() / 1000)
    const expireSeconds = Math.min(Number(this.configService.get<string>('TENCENT_VOD_EXPIRE_SECONDS') || 3600) || 3600, 7776000)
    const expireTime = currentTimeStamp + expireSeconds
    const args: Record<string, string | number> = {
      secretId,
      currentTimeStamp,
      expireTime,
      random: randomInt(0, 4294967295),
    }
    const procedure = this.configService.get<string>('TENCENT_VOD_PROCEDURE')
    const storageRegion = this.configService.get<string>('TENCENT_VOD_STORAGE_REGION')
    const vodSubAppId = Number(this.configService.get<string>('TENCENT_VOD_SUB_APP_ID') || 0)
    const classId = Number(this.configService.get<string>('TENCENT_VOD_CLASS_ID') || 0)
    if (procedure) args.procedure = procedure
    if (storageRegion) args.storageRegion = storageRegion
    if (vodSubAppId > 0) args.vodSubAppId = vodSubAppId
    if (classId > 0) args.classId = classId

    const original = stringify(args)
    const hmac = createHmac('sha1', secretKey).update(Buffer.from(original, 'utf8')).digest()
    const signature = Buffer.concat([hmac, Buffer.from(original, 'utf8')]).toString('base64')

    return {
      signature,
      expireTime,
      currentTimeStamp,
      vodSubAppId: vodSubAppId > 0 ? vodSubAppId : undefined,
    }
  }

  async upsertAdminVideo(dto: Record<string, unknown>) {
    const id = typeof dto.id === 'string' && dto.id ? dto.id : undefined
    const module = getNursingModule(typeof dto.moduleCode === 'string' ? dto.moduleCode : typeof dto.moduleName === 'string' ? dto.moduleName : undefined)
    const title = typeof dto.title === 'string' && dto.title ? dto.title : '未命名公开讲解'
    const duration = typeof dto.duration === 'number' ? dto.duration : Number(dto.duration || 0) || 0
    const difficulty = typeof dto.difficulty === 'string' && dto.difficulty ? dto.difficulty : 'basic'
    const knowledgeTags = Array.isArray(dto.knowledgeTags) ? dto.knowledgeTags.join(',') : typeof dto.knowledgeTags === 'string' ? dto.knowledgeTags : ''
    const status = this.resolveContentStatus(dto.status)
    if (status === ContentStatus.published) this.validatePublishedVideo(dto)
    const data = {
      subjectCode: SubjectCode.nursing,
      moduleCode: module.moduleCode,
      moduleName: module.moduleName,
      chapter: typeof dto.chapter === 'string' && dto.chapter ? dto.chapter : '待补充小章节',
      title,
      duration,
      difficulty,
      knowledgeTags,
      coverUrl: typeof dto.coverUrl === 'string' ? dto.coverUrl : undefined,
      assetKey: typeof dto.assetKey === 'string' ? dto.assetKey : undefined,
      videoUrl: typeof dto.videoUrl === 'string' ? dto.videoUrl : undefined,
      status,
    }

    if (id) {
      const saved = await this.prisma.videoLesson.upsert({
        where: { id },
        update: data,
        create: { id, ...data },
      })
      await this.recordAdminAudit('video.upsert', saved.id, { title, status })
      return saved
    }

    const created = await this.prisma.videoLesson.create({ data })
    await this.recordAdminAudit('video.create', created.id, { title, status })
    return created
  }

  async deleteAdminVideo(id: string) {
    const updated = await this.prisma.videoLesson.update({
      where: { id },
      data: { status: ContentStatus.offline },
    })
    await this.recordAdminAudit('video.offline', id, { title: updated.title })
    return updated
  }

  async adminDailyPractice() {
    return this.prisma.dailyPractice.findMany({
      where: { subjectCode: SubjectCode.nursing },
      orderBy: { date: 'desc' },
    })
  }

  async upsertAdminQuestion(dto: Record<string, unknown>) {
    const id = typeof dto.id === 'string' && dto.id ? dto.id : undefined
    const title = typeof dto.title === 'string' && dto.title ? dto.title : '未命名题目'
    const rawType = typeof dto.type === 'string' ? dto.type : 'single_choice'
    const type = rawType === 'blank' || rawType === 'solution' ? 'short_answer' : rawType
    const difficulty = typeof dto.difficulty === 'string' && dto.difficulty ? dto.difficulty : 'basic'
    const knowledgeTags = Array.isArray(dto.knowledgeTags) ? dto.knowledgeTags.join(',') : typeof dto.knowledgeTags === 'string' ? dto.knowledgeTags : ''
    const answer = typeof dto.answer === 'string' ? dto.answer : ''
    const source = typeof dto.source === 'string' ? dto.source : 'admin'
    const status = this.resolveContentStatus(dto.status)

    const module = getNursingModule(typeof dto.moduleCode === 'string' ? dto.moduleCode : typeof dto.moduleName === 'string' ? dto.moduleName : undefined)
    const chapter = typeof dto.chapter === 'string' && dto.chapter ? dto.chapter : '待补充小章节'
    const chapterSort = typeof dto.chapterSort === 'number' ? dto.chapterSort : 1
    const optionsJson = typeof dto.optionsJson === 'string' ? dto.optionsJson : Array.isArray(dto.options) ? JSON.stringify(dto.options) : '[]'
    const options = this.parseOptions(optionsJson)
    if (status === ContentStatus.published) this.validatePublishedQuestion(dto, options)
    const stem = typeof dto.stem === 'string' && dto.stem ? dto.stem : title
    const analysis = typeof dto.analysis === 'string' ? dto.analysis : ''

    const data = {
      subjectCode: SubjectCode.nursing,
      moduleCode: module.moduleCode,
      moduleName: module.moduleName,
      chapter,
      chapterSort,
      title,
      stem,
      type: type as never,
      difficulty,
      knowledgeTags,
      optionsJson,
      answer,
      analysis,
      source,
      status,
    }

    if (id) {
      const saved = await this.prisma.question.upsert({
        where: { id },
        update: data,
        create: { id, ...data },
      })
      await this.recordAdminAudit('question.upsert', saved.id, { title, status })
      return saved
    }

    const created = await this.prisma.question.create({ data })
    await this.recordAdminAudit('question.create', created.id, { title, status })
    return created
  }

  async batchPublishQuestions(dto: { ids?: string[]; filter?: { status?: string; moduleCode?: string } }) {
    const where: Record<string, unknown> = { subjectCode: SubjectCode.nursing, status: ContentStatus.draft }
    if (dto.ids?.length) {
      where.id = { in: dto.ids }
    }
    if (dto.filter?.moduleCode) {
      where.moduleCode = dto.filter.moduleCode
    }
    const candidates = await this.prisma.question.findMany({ where: where as any })
    if (candidates.length === 0) return { published: 0, skipped: 0, errors: [] }

    const publishIds: string[] = []
    const errors: Array<{ id: string; title: string; reason: string }> = []

    for (const q of candidates) {
      try {
        const options = this.parseOptions(q.optionsJson)
        this.validatePublishedQuestion(
          { title: q.title, stem: q.stem, moduleCode: q.moduleCode, moduleName: q.moduleName, chapter: q.chapter, answer: q.answer, analysis: q.analysis, knowledgeTags: q.knowledgeTags, type: q.type },
          options,
        )
        publishIds.push(q.id)
      } catch (err) {
        errors.push({ id: q.id, title: q.title, reason: err instanceof Error ? err.message : '校验失败' })
      }
    }

    if (publishIds.length > 0) {
      await this.prisma.question.updateMany({
        where: { id: { in: publishIds } },
        data: { status: ContentStatus.published },
      })
    }
    await this.recordAdminAudit('question.batch_publish', '-', { count: publishIds.length, skipped: errors.length, filter: dto.filter })
    return { published: publishIds.length, skipped: errors.length, errors: errors.slice(0, 20) }
  }

  async previewQuestionImport(questionDoc: Buffer, questionDocName: string, answerDoc?: Buffer) {
    if (!questionDoc?.length) throw new BadRequestException('请上传题目 Word 文档')
    return previewQuestionImport(questionDoc, questionDocName, answerDoc)
  }

  async commitQuestionImport(dto: Record<string, unknown>) {
    const rawItems = Array.isArray(dto.items) ? dto.items : Array.isArray(dto.questions) ? dto.questions : []
    if (rawItems.length === 0) throw new BadRequestException('没有可导入的题目')

    const imported: ParsedQuestionImportItem[] = []
    const failed: Array<{ title?: string; message: string }> = []

    for (const rawItem of rawItems) {
      const item = rawItem as ParsedQuestionImportItem
      try {
        const saved = await this.upsertAdminQuestion({
          ...item,
          status: ContentStatus.draft,
        } as unknown as Record<string, unknown>)
        imported.push(saved as unknown as ParsedQuestionImportItem)
      } catch (error) {
        failed.push({
          title: typeof item.title === 'string' ? item.title : undefined,
          message: error instanceof Error ? error.message : '导入失败',
        })
      }
    }

    return {
      imported: imported.length,
      failed: failed.length,
      failures: failed,
    }
  }

  async deleteAdminQuestion(id: string) {
    const updated = await this.prisma.question.update({
      where: { id },
      data: { status: ContentStatus.offline },
    })
    await this.recordAdminAudit('question.offline', id, { title: updated.title })
    return updated
  }

  async upsertDailyPractice(dto: CreateDailyPracticeDto) {
    const question = await this.prisma.question.findFirst({
      where: { id: dto.questionId, subjectCode: SubjectCode.nursing },
    })
    if (!question) throw new NotFoundException('题目不存在')
    const status = this.resolveContentStatus(dto.status)
    if (status === ContentStatus.published && question.status !== ContentStatus.published) {
      throw new BadRequestException('每日练习发布前，关联题目必须先发布')
    }

    const existing = await this.prisma.dailyPractice.findFirst({
      where: { subjectCode: SubjectCode.nursing, date: new Date(dto.date) },
    })

    if (existing) {
      return this.prisma.dailyPractice.update({
        where: { id: existing.id },
        data: {
          questionId: question.id,
          questionTitle: question.title,
          knowledgeTags: question.knowledgeTags,
          status,
          date: new Date(dto.date),
        },
      })
    }

    return this.prisma.dailyPractice.create({
      data: {
        subjectCode: SubjectCode.nursing,
        date: new Date(dto.date),
        questionId: question.id,
        questionTitle: question.title,
        knowledgeTags: question.knowledgeTags,
        status,
      },
    })
  }

  // === 新增方法 ===

  async getHomeConfig() {
    const config = await this.prisma.systemConfig.findFirst({ where: { key: 'home_config' } }).catch(() => null)
    if (!config?.value) return { notice: '', dailyQuote: '', examCountdown: 45, aboutText: '' }
    try { return JSON.parse(config.value) } catch { return { notice: '', dailyQuote: '', examCountdown: 45, aboutText: '' } }
  }

  async saveHomeConfig(dto: Record<string, unknown>) {
    const value = JSON.stringify({ notice: dto.notice || '', dailyQuote: dto.dailyQuote || '', examCountdown: dto.examCountdown ?? 45, aboutText: dto.aboutText || '' })
    await this.prisma.systemConfig.upsert({ where: { key: 'home_config' }, create: { key: 'home_config', value }, update: { value } })
    return { ok: true }
  }

  async getRanking(type: string, currentOpenId?: string) {
    const users = await this.prisma.user.findMany({ select: { id: true, openId: true, nickname: true } })
    const userIdToOpenId = new Map(users.map((u) => [u.id, u.openId]))
    const openIdToNickname = new Map(users.map((u) => [u.openId, u.nickname || '医护同学']))

    const records = await this.prisma.practiceRecord.groupBy({ by: ['userId'], _count: { id: true } })

    let list: Array<{ openId: string; nickname: string; value: number }>

    if (type === 'rate') {
      const correctRecords = await this.prisma.practiceRecord.groupBy({ by: ['userId'], _count: { id: true }, where: { isCorrect: true } })
      const correctMap = new Map(correctRecords.map((r) => [r.userId, r._count.id]))
      list = records.map((r) => {
        const oid = userIdToOpenId.get(r.userId) || ''
        return { openId: oid, nickname: openIdToNickname.get(oid) || '医护同学', value: r._count.id > 0 ? Math.round((correctMap.get(r.userId) || 0) / r._count.id * 100) : 0 }
      })
    } else if (type === 'count') {
      list = records.map((r) => {
        const oid = userIdToOpenId.get(r.userId) || ''
        return { openId: oid, nickname: openIdToNickname.get(oid) || '医护同学', value: r._count.id }
      })
    } else {
      const allRecords = await this.prisma.practiceRecord.findMany({ select: { userId: true, createdAt: true } })
      const dayMap = new Map<string, Set<string>>()
      allRecords.forEach((r) => {
        if (!dayMap.has(r.userId)) dayMap.set(r.userId, new Set())
        dayMap.get(r.userId)!.add(r.createdAt.toISOString().slice(0, 10))
      })
      list = Array.from(dayMap.entries()).map(([userId, days]) => {
        const oid = userIdToOpenId.get(userId) || ''
        return { openId: oid, nickname: openIdToNickname.get(oid) || '医护同学', value: days.size }
      })
    }

    list.sort((a, b) => b.value - a.value)
    const top = list.slice(0, 50)
    const myIndex = currentOpenId ? list.findIndex((item) => item.openId === currentOpenId) : -1
    const me = myIndex >= 0 ? { rank: myIndex + 1, value: list[myIndex].value } : null
    return { list: top, me }
  }

  async recordVideoPlay(openId: string | undefined, videoId: string) {
    if (!openId || !videoId) return { ok: false }
    const user = await this.prisma.user.findUnique({ where: { openId } })
    if (!user) return { ok: false }
    await this.prisma.videoPlayRecord.create({ data: { userId: user.id, videoId } })
    return { ok: true }
  }

  async batchGenerateLicenseTokens(dto: { count: number; expiresDays?: number; subjectScope?: string; groupTag?: string }) {
    const count = Math.min(Math.max(dto.count || 1, 1), 100)
    const expiresDays = dto.expiresDays || 90
    const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000)
    const tokens: Array<{ code: string; expiresAt: string }> = []

    for (let i = 0; i < count; i++) {
      const code = this.generateLicenseCode()
      await this.prisma.licenseToken.create({
        data: { code, subjectScope: SubjectCode.nursing, resourceScope: '医护题库、解析、案例材料、公开讲解', status: LicenseStatus.unused, expiresAt, maxBindCount: 1, groupTag: dto.groupTag || null },
      })
      tokens.push({ code, expiresAt: expiresAt.toISOString() })
    }
    await this.recordAdminAudit('license.batch_generate', undefined, { count, expiresAt, groupTag: dto.groupTag || null })
    return tokens
  }

  async getStudentDetail(openId: string) {
    const user = await this.prisma.user.findUnique({ where: { openId }, include: { authorization: { include: { licenseToken: true } } } })
    if (!user) throw new NotFoundException('学生不存在')

    const records = await this.prisma.practiceRecord.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
    const mistakes = await this.prisma.mistake.findMany({ where: { userId: user.id }, include: { question: { select: { title: true, chapter: true } } }, orderBy: { updatedAt: 'desc' }, take: 20 })
    const favorites = await this.prisma.favorite.count({ where: { userId: user.id } })

    const totalRecords = records.length
    const correctRecords = records.filter((r) => r.isCorrect).length
    const correctRate = totalRecords > 0 ? Math.round(correctRecords / totalRecords * 100) : 0

    const daySet = new Set(records.map((r) => r.createdAt.toISOString().slice(0, 10)))
    const practiceDays = daySet.size

    const today = new Date()
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const recentRecords = records.filter((r) => r.createdAt >= sevenDaysAgo)
    const recentDaySet = new Set(recentRecords.map((r) => r.createdAt.toISOString().slice(0, 10)))

    const weeklyActivity: Array<{ date: string; count: number }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = d.toISOString().slice(0, 10)
      weeklyActivity.push({ date: dateStr, count: recentRecords.filter((r) => r.createdAt.toISOString().slice(0, 10) === dateStr).length })
    }

    const moduleMap = new Map<string, { completedQuestions: number; correct: number }>()
    for (const r of records) {
      const question = await this.prisma.question.findUnique({ where: { id: r.questionId }, select: { moduleCode: true } }).catch(() => null)
      const mod = question?.moduleCode || 'unknown'
      const current = moduleMap.get(mod) || { completedQuestions: 0, correct: 0 }
      current.completedQuestions += 1
      if (r.isCorrect) current.correct += 1
      moduleMap.set(mod, current)
    }

    const moduleProgress = Array.from(moduleMap.entries()).map(([moduleCode, stats]) => ({
      moduleCode,
      moduleName: getNursingModule(moduleCode)?.moduleName || moduleCode,
      totalQuestions: stats.completedQuestions,
      completedQuestions: stats.completedQuestions,
      correctRate: stats.completedQuestions > 0 ? Math.round(stats.correct / stats.completedQuestions * 100) : 0,
    }))

    const auth = user.authorization
    const license = auth?.licenseToken

    return {
      userId: user.id,
      openId: user.openId,
      nickname: user.nickname || '医护同学',
      avatarUrl: user.avatarUrl,
      practiceCount: totalRecords,
      correctRate,
      mistakeCount: mistakes.length,
      favoriteCount: favorites,
      practiceDays,
      recentPracticeDays: recentDaySet.size,
      lastActiveAt: records[0]?.createdAt?.toISOString() || null,
      licenseCode: license?.code || null,
      licenseStatus: license?.status || null,
      activatedAt: auth?.activatedAt?.toISOString() || null,
      expiresAt: license?.expiresAt?.toISOString() || null,
      moduleProgress,
      recentMistakes: mistakes.map((m) => ({
        questionId: m.questionId,
        title: m.question?.title || '未知题目',
        chapter: m.question?.chapter || '未知章节',
        wrongCount: m.wrongCount,
        lastWrongAt: m.updatedAt.toISOString(),
      })),
      weeklyActivity,
    }
  }

  async adminTrends(days: number) {
    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(now.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)

    const records = await this.prisma.practiceRecord.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true, isCorrect: true, userId: true },
    })

    const dailyMap = new Map<string, { date: string; count: number; correct: number; activeUsers: Set<string> }>()
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      dailyMap.set(key, { date: key, count: 0, correct: 0, activeUsers: new Set() })
    }

    for (const r of records) {
      const key = r.createdAt.toISOString().slice(0, 10)
      const day = dailyMap.get(key)
      if (!day) continue
      day.count++
      if (r.isCorrect) day.correct++
      day.activeUsers.add(r.userId)
    }

    return Array.from(dailyMap.values()).map((d) => ({
      date: d.date,
      practiceCount: d.count,
      correctRate: d.count > 0 ? Math.round((d.correct / d.count) * 100) : 0,
      activeUsers: d.activeUsers.size,
    }))
  }

  async adminAlerts() {
    const now = new Date()
    const threeDaysAgo = new Date(now)
    threeDaysAgo.setDate(now.getDate() - 3)
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 7)
    const fifteenDaysLater = new Date(now)
    fifteenDaysLater.setDate(now.getDate() + 15)

    const [inactiveUsers, expiringTokens, hardQuestions, activationAttempts] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          authorization: { isNot: null },
          practiceRecords: { none: { createdAt: { gte: threeDaysAgo } } },
        },
        select: { openId: true, nickname: true, lastLoginAt: true },
      }),
      this.prisma.licenseToken.findMany({
        where: {
          status: 'bound',
          expiresAt: { gte: now, lte: fifteenDaysLater },
        },
        select: { code: true, boundOpenId: true, expiresAt: true },
      }),
      this.prisma.practiceRecord.groupBy({
        by: ['questionId'],
        where: { createdAt: { gte: sevenDaysAgo } },
        _count: { id: true },
      }),
      this.prisma.licenseActivationAttempt.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          OR: [
            { reason: 'bound_to_other_account' },
            { reason: 'not_found' },
            { result: 'failed' },
          ],
        },
        select: {
          id: true,
          codeInput: true,
          openId: true,
          result: true,
          reason: true,
          tokenId: true,
          clientEnv: true,
          platform: true,
          device: true,
          ip: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ])

    const recentRecords = await this.prisma.practiceRecord.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { questionId: true, isCorrect: true },
    })
    const questionStats = new Map<string, { total: number; wrong: number }>()
    for (const r of recentRecords) {
      const s = questionStats.get(r.questionId) ?? { total: 0, wrong: 0 }
      s.total++
      if (!r.isCorrect) s.wrong++
      questionStats.set(r.questionId, s)
    }
    const lowAccuracyQuestions = Array.from(questionStats.entries())
      .filter(([, s]) => s.total >= 5 && (s.wrong / s.total) > 0.6)
      .map(([questionId, s]) => ({ questionId, total: s.total, wrongRate: Math.round((s.wrong / s.total) * 100) }))
      .sort((a, b) => b.wrongRate - a.wrongRate)
      .slice(0, 10)

    const questionIds = lowAccuracyQuestions.map((q) => q.questionId)
    const questionTitles = questionIds.length > 0
      ? await this.prisma.question.findMany({ where: { id: { in: questionIds } }, select: { id: true, title: true } })
      : []
    const titleMap = new Map(questionTitles.map((q) => [q.id, q.title]))
    const tokenAttempts = new Map<string, ActivationAttemptSnapshot[]>()
    const invalidAttempts = new Map<string, ActivationAttemptSnapshot[]>()
    for (const attempt of activationAttempts) {
      if (attempt.tokenId) {
        const attempts = tokenAttempts.get(attempt.tokenId) || []
        attempts.push(attempt)
        tokenAttempts.set(attempt.tokenId, attempts)
      }
      if (attempt.reason === 'not_found') {
        const attempts = invalidAttempts.get(attempt.openId) || []
        attempts.push(attempt)
        invalidAttempts.set(attempt.openId, attempts)
      }
    }
    const sharedCodeRisks = Array.from(tokenAttempts.entries())
      .map(([tokenId, attempts]) => ({
        tokenId,
        distinctOpenIdCount: new Set(attempts.map((attempt) => attempt.openId)).size,
        attemptCount: attempts.length,
        lastReason: attempts[0]?.reason || '',
        lastAttemptAt: attempts[0]?.createdAt.toISOString() || null,
      }))
      .filter((item) => item.distinctOpenIdCount > 1 || item.lastReason === 'bound_to_other_account')
    const invalidCodeRisks = Array.from(invalidAttempts.entries())
      .map(([openId, attempts]) => ({
        openId,
        attemptCount: attempts.length,
        lastAttemptAt: attempts[0]?.createdAt.toISOString() || null,
      }))
      .filter((item) => item.attemptCount >= 3)

    return {
      inactive: inactiveUsers.map((u) => ({
        openId: u.openId,
        nickname: u.nickname || '微信用户',
        lastLoginAt: u.lastLoginAt?.toISOString() || null,
      })),
      expiringTokens: expiringTokens.map((t) => ({
        code: t.code,
        boundOpenId: t.boundOpenId,
        expiresAt: t.expiresAt?.toISOString(),
      })),
      lowAccuracyQuestions: lowAccuracyQuestions.map((q) => ({
        ...q,
        title: titleMap.get(q.questionId) || q.questionId,
      })),
      activationAnomalies: [
        ...sharedCodeRisks.map((item) => ({
          type: 'shared_code',
          message: `同一通行码被 ${item.distinctOpenIdCount} 个账号尝试`,
          tokenId: item.tokenId,
          openId: null,
          count: item.attemptCount,
          lastAttemptAt: item.lastAttemptAt,
        })),
        ...invalidCodeRisks.map((item) => ({
          type: 'invalid_code',
          message: `同一账号近 7 天输入 ${item.attemptCount} 次无效码`,
          tokenId: null,
          openId: item.openId,
          count: item.attemptCount,
          lastAttemptAt: item.lastAttemptAt,
        })),
      ].slice(0, 10),
    }
  }

  async adminExportStudents() {
    const [users, authorizations, records, mistakes] = await Promise.all([
      this.prisma.user.findMany({ select: { id: true, openId: true, nickname: true } }),
      this.prisma.userAuthorization.findMany({ include: { licenseToken: true } }),
      this.prisma.practiceRecord.findMany({ select: { userId: true, isCorrect: true, createdAt: true } }),
      this.prisma.mistake.findMany({ select: { userId: true, wrongCount: true } }),
    ])

    const authMap = new Map(authorizations.map((a) => [a.userId, a]))
    const rows = users.map((user) => {
      const userRecords = records.filter((r) => r.userId === user.id)
      const userMistakes = mistakes.filter((m) => m.userId === user.id)
      const correct = userRecords.filter((r) => r.isCorrect).length
      const auth = authMap.get(user.id)
      const practiceDays = new Set(userRecords.map((r) => r.createdAt.toISOString().slice(0, 10))).size

      return {
        openId: user.openId,
        nickname: user.nickname || '微信用户',
        practiceCount: userRecords.length,
        correctRate: userRecords.length > 0 ? Math.round((correct / userRecords.length) * 100) : 0,
        mistakeCount: userMistakes.reduce((s, m) => s + m.wrongCount, 0),
        practiceDays,
        licenseCode: auth?.licenseToken?.code || '',
        licenseStatus: auth?.licenseToken?.status || '',
        groupTag: (auth?.licenseToken as any)?.groupTag || '',
        activatedAt: auth?.activatedAt?.toISOString().slice(0, 10) || '',
        expiresAt: auth?.licenseToken?.expiresAt?.toISOString().slice(0, 10) || '',
      }
    })

    return { rows: rows.sort((a, b) => b.practiceCount - a.practiceCount) }
  }

  async adminExportMistakes() {
    const mistakes = await this.prisma.mistake.findMany({
      where: { wrongCount: { gte: 1 } },
      include: { question: { select: { id: true, title: true, chapter: true, moduleCode: true, moduleName: true } }, user: { select: { openId: true, nickname: true } } },
      orderBy: { wrongCount: 'desc' },
      take: 500,
    })

    return {
      rows: mistakes.map((m) => ({
        openId: m.user.openId,
        nickname: m.user.nickname || '微信用户',
        questionTitle: m.question.title,
        chapter: m.question.chapter,
        moduleName: m.question.moduleName,
        wrongCount: m.wrongCount,
        lastWrongAt: m.lastWrongAt?.toISOString().slice(0, 10) || m.updatedAt.toISOString().slice(0, 10),
        mastered: m.mastered,
      })),
    }
  }

  async adminGroups() {
    const tokens = await this.prisma.licenseToken.findMany({
      where: { groupTag: { not: null } },
      select: { groupTag: true, status: true, boundOpenId: true },
    })

    const groupMap = new Map<string, { total: number; bound: number; unused: number }>()
    for (const t of tokens) {
      const tag = t.groupTag!
      const g = groupMap.get(tag) ?? { total: 0, bound: 0, unused: 0 }
      g.total++
      if (t.status === 'bound') g.bound++
      if (t.status === 'unused') g.unused++
      groupMap.set(tag, g)
    }

    return Array.from(groupMap.entries()).map(([groupTag, stats]) => ({ groupTag, ...stats }))
  }

  async adminAuditLogs(limit: number) {
    return this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    })
  }
}
