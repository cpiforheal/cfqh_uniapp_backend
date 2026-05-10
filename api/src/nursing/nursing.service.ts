import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ContentStatus, LicenseStatus, Prisma, SubjectCode } from '@prisma/client'
import { createHmac, randomInt } from 'node:crypto'
import { stringify } from 'node:querystring'
import { PrismaService } from '../prisma/prisma.service'
import { CreateDailyPracticeDto } from './dto/create-daily-practice.dto'
import { NURSING_MODULES, getNursingModule } from './modules'
import { ParsedQuestionImportItem, previewQuestionImport } from './question-import'

@Injectable()
export class NursingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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

  async moduleQuestions(moduleCode: string) {
    const questions = await this.prisma.question.findMany({
      where: { subjectCode: SubjectCode.nursing, moduleCode, status: ContentStatus.published },
      orderBy: [{ chapterSort: 'asc' }, { updatedAt: 'desc' }],
    })
    return questions.map((question) => this.serializeQuestion(question))
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
    const [question, allQuestions, user] = await Promise.all([
      this.prisma.question.findFirst({
        where: { id, subjectCode: SubjectCode.nursing, status: ContentStatus.published },
      }),
      this.prisma.question.findMany({
        where: { subjectCode: SubjectCode.nursing, status: ContentStatus.published },
        select: { id: true },
        orderBy: [{ chapterSort: 'asc' }, { updatedAt: 'desc' }],
      }),
      this.getUserByOpenId(openId),
    ])
    if (!question) throw new NotFoundException('题目不存在')

    const tags = question.knowledgeTags.split(',').map((item) => item.trim()).filter(Boolean)
    const currentIndex = allQuestions.findIndex((item) => item.id === question.id)
    const nextQuestionId = allQuestions[currentIndex + 1]?.id ?? allQuestions[0]?.id ?? null

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
      progress: this.getQuestionProgress(currentIndex, allQuestions.length),
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
    const [dailyPractice, videos, confusingPoints, memoryTips, questions, user] = await Promise.all([
      this.dailyPractice(),
      this.videos(),
      this.confusingPoints(),
      this.memoryTips(),
      this.prisma.question.findMany({
        where: { subjectCode: SubjectCode.nursing, status: ContentStatus.published },
        orderBy: [{ chapterSort: 'asc' }, { updatedAt: 'desc' }],
      }),
      this.getUserByOpenId(openId),
    ])

    const [records, mistakes] = user
      ? await Promise.all([
          this.prisma.practiceRecord.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
          this.prisma.mistake.findMany({ where: { userId: user.id }, orderBy: { updatedAt: 'desc' }, take: 3 }),
        ])
      : [[], []]
    const daily = dailyPractice[0] ?? null
    const dailyQuestion = daily ? questions.find((question) => question.id === daily.questionId) ?? null : questions[0] ?? null
    const continueQuestion = records[0]
      ? questions.find((question) => question.id === records[0].questionId) ?? dailyQuestion
      : dailyQuestion
    const recentMistakes = mistakes
      .map((mistake) => {
        const question = questions.find((item) => item.id === mistake.questionId)
        return question ? { ...question, wrongCount: mistake.wrongCount } : null
      })
      .filter((question): question is NonNullable<typeof question> => Boolean(question))
    const recommendationSeeds = [
      dailyQuestion,
      ...questions.filter((question) => question.id !== continueQuestion?.id && question.id !== dailyQuestion?.id),
    ].filter((question): question is NonNullable<typeof question> => Boolean(question))
    const progressDone = new Set(records.map((record) => record.questionId)).size
    const progressTotal = questions.length

    return {
      subjectCode: 'nursing',
      subjectName: '医护大类',
      authorization: user ? { status: 'authorized' } : { status: 'unknown' },
      progress: {
        done: progressDone,
        total: progressTotal,
        percent: progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0,
      },
      continueQuestion: continueQuestion ? this.serializeQuestion(continueQuestion) : null,
      dailyPractice: daily,
      dailyQuestion: dailyQuestion ? this.serializeQuestion(dailyQuestion) : null,
      recommendedQuestions: recommendationSeeds.slice(0, 5).map((question) => this.serializeQuestion(question)),
      recentMistakes: recentMistakes.map((question) => this.serializeQuestion(question)),
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
      return videoAsset.upsert({ where: { id }, update: data, create: { id, ...data } })
    }

    return videoAsset.create({ data })
  }

  async deleteAdminAsset(id: string) {
    const videoAsset = (this.prisma as any).videoAsset
    if (!videoAsset?.update) return null
    return videoAsset.update({ where: { id }, data: { status: ContentStatus.offline } })
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

    return users.map((user) => ({
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
    }))
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

    return tokens.map((token) => ({
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
    }))
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

    return {
      userId: user.id,
      openId: user.openId,
      licenseToken: created,
    }
  }

  async disableLicenseToken(id: string) {
    return this.prisma.licenseToken.update({
      where: { id },
      data: { status: LicenseStatus.disabled },
    })
  }

  async deleteLicenseToken(id: string) {
    const token = await this.prisma.licenseToken.findUnique({
      where: { id },
      include: { authorization: { select: { id: true } } },
    })
    if (!token) throw new NotFoundException('授权码不存在')
    if (token.authorization.length > 0) throw new BadRequestException('该授权码仍关联账号授权，请先禁用或更换该账号授权后再删除')
    if (this.getEffectiveLicenseStatus(token) === LicenseStatus.bound) throw new BadRequestException('已绑定且仍有效的授权码不能直接删除')

    return this.prisma.licenseToken.delete({ where: { id } })
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

    return this.prisma.licenseToken.update({
      where: { id },
      data: {
        expiresAt: nextExpiresAt,
        status: token.status === LicenseStatus.expired ? LicenseStatus.bound : token.status,
      },
    })
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
      return this.prisma.videoLesson.upsert({
        where: { id },
        update: data,
        create: { id, ...data },
      })
    }

    return this.prisma.videoLesson.create({ data })
  }

  async deleteAdminVideo(id: string) {
    return this.prisma.videoLesson.update({
      where: { id },
      data: { status: ContentStatus.offline },
    })
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
      return this.prisma.question.upsert({
        where: { id },
        update: data,
        create: { id, ...data },
      })
    }

    return this.prisma.question.create({ data })
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
    return this.prisma.question.update({
      where: { id },
      data: { status: ContentStatus.offline },
    })
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
}
