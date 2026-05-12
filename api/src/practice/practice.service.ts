import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateFavoriteDto } from './dto/create-favorite.dto'
import { CreatePracticeRecordDto } from './dto/create-practice-record.dto'

@Injectable()
export class PracticeService {
  constructor(private readonly prisma: PrismaService) {}

  private async getUserId(openId: string) {
    const user = await this.prisma.user.findUnique({ where: { openId } })
    if (!user) throw new NotFoundException('用户不存在')
    return user.id
  }

  async createRecord(dto: CreatePracticeRecordDto, openId: string) {
    const userId = await this.getUserId(openId)
    const record = await this.prisma.practiceRecord.create({
      data: {
        userId,
        questionId: dto.questionId,
        submittedAnswer: dto.submittedAnswer,
        selectedOption: dto.selectedOption,
        isCorrect: dto.isCorrect,
        practiceMode: dto.practiceMode || 'daily',
        sequenceNo: dto.sequenceNo,
        totalCount: dto.totalCount,
        durationMs: dto.durationMs,
        sessionId: dto.sessionId,
      },
    })

    if (!dto.isCorrect) {
      const reviewDays = dto.reviewFrequency === 'alternate' ? 2 : dto.reviewFrequency === 'exam' ? 1 : 1
      const nextReviewAt = new Date(Date.now() + reviewDays * 24 * 60 * 60 * 1000)
      await this.prisma.mistake.upsert({
        where: { userId_questionId: { userId, questionId: dto.questionId } },
        update: { wrongCount: { increment: 1 }, lastWrongAt: new Date(), selectedOption: dto.selectedOption, nextReviewAt, mastered: false },
        create: { userId, questionId: dto.questionId, wrongCount: 1, lastWrongAt: new Date(), selectedOption: dto.selectedOption, nextReviewAt },
      })
    } else {
      const existing = await this.prisma.mistake.findUnique({ where: { userId_questionId: { userId, questionId: dto.questionId } } })
      if (existing && !existing.mastered) {
        const baseInterval = dto.reviewFrequency === 'exam' ? 1 : dto.reviewFrequency === 'alternate' ? 2 : 3
        const interval = Math.min((existing.wrongCount || 1) * baseInterval, 14)
        await this.prisma.mistake.update({
          where: { id: existing.id },
          data: { nextReviewAt: new Date(Date.now() + interval * 24 * 60 * 60 * 1000) },
        })
      }
    }

    return record
  }

  async listMistakes(openId: string) {
    const userId = await this.getUserId(openId)
    return this.prisma.mistake.findMany({
      where: { userId, mastered: false },
      include: { question: { select: { id: true, title: true, stem: true, chapter: true, moduleCode: true, moduleName: true, difficulty: true, type: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
  }

  async listFavorites(openId: string) {
    const userId = await this.getUserId(openId)
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    const questionIds = favorites.map((f) => f.questionId)
    const questions = await this.prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, title: true, stem: true, chapter: true, moduleCode: true, moduleName: true, difficulty: true, type: true },
    })
    const questionMap = new Map(questions.map((q) => [q.id, q]))
    return favorites.map((f) => ({ ...f, question: questionMap.get(f.questionId) || null }))
  }

  async removeFavorite(questionId: string, openId: string) {
    const userId = await this.getUserId(openId)
    await this.prisma.favorite.deleteMany({ where: { userId, questionId } })
    return { success: true }
  }

  async learningReport(openId: string) {
    const userId = await this.getUserId(openId)
    const [records, mistakes, favorites] = await Promise.all([
      this.prisma.practiceRecord.findMany({ where: { userId }, select: { isCorrect: true, createdAt: true, questionId: true } }),
      this.prisma.mistake.count({ where: { userId } }),
      this.prisma.favorite.count({ where: { userId } }),
    ])

    const totalPractice = records.length
    const correctCount = records.filter((r) => r.isCorrect).length
    const correctRate = totalPractice > 0 ? Math.round((correctCount / totalPractice) * 100) : 0
    const practiceDays = new Set(records.map((r) => r.createdAt.toISOString().slice(0, 10))).size
    const uniqueQuestions = new Set(records.map((r) => r.questionId)).size

    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)
    const weeklyRecords = records.filter((r) => r.createdAt >= sevenDaysAgo)
    const weeklyDays = new Set(weeklyRecords.map((r) => r.createdAt.toISOString().slice(0, 10))).size

    return {
      totalPractice,
      correctRate,
      practiceDays,
      uniqueQuestions,
      mistakeCount: mistakes,
      favoriteCount: favorites,
      weeklyActiveDays: weeklyDays,
      weeklyPracticeCount: weeklyRecords.length,
    }
  }

  async createFavorite(dto: CreateFavoriteDto, openId: string) {
    const userId = await this.getUserId(openId)
    return this.prisma.favorite.upsert({
      where: { userId_questionId: { userId, questionId: dto.questionId } },
      update: {},
      create: { userId, questionId: dto.questionId },
    })
  }

  async reviewToday(openId: string) {
    const userId = await this.getUserId(openId)
    const now = new Date()
    const reviewWhere = { userId, mastered: false, OR: [{ nextReviewAt: { lte: now } }, { nextReviewAt: null }] }
    const [totalCount, mistakes] = await Promise.all([
      this.prisma.mistake.count({ where: reviewWhere }),
      this.prisma.mistake.findMany({
        where: reviewWhere,
        include: { question: { select: { id: true, title: true, chapter: true, moduleName: true } } },
        orderBy: { wrongCount: 'desc' },
        take: 20,
      }),
    ])
    return {
      count: totalCount,
      questions: mistakes.map((m) => ({
        id: m.question.id,
        title: m.question.title,
        chapter: m.question.chapter,
        moduleName: m.question.moduleName,
        wrongCount: m.wrongCount,
      })),
    }
  }

  async learningReportFull(openId: string, range: '7d' | '30d' | 'all' = '7d') {
    const userId = await this.getUserId(openId)
    const now = new Date()
    const rangeStart = new Date(now)
    if (range === '7d') rangeStart.setDate(now.getDate() - 6)
    else if (range === '30d') rangeStart.setDate(now.getDate() - 29)
    else rangeStart.setDate(now.getDate() - 29)
    rangeStart.setHours(0, 0, 0, 0)

    const [allRecords, rangeMistakes, allMistakes, favorites, questions] = await Promise.all([
      this.prisma.practiceRecord.findMany({ where: { userId }, select: { questionId: true, isCorrect: true, createdAt: true } }),
      this.prisma.mistake.findMany({ where: { userId, mastered: false }, include: { question: { select: { chapter: true, moduleCode: true, moduleName: true } } } }),
      this.prisma.mistake.findMany({ where: { userId, mastered: false, OR: [{ nextReviewAt: { lte: now } }, { nextReviewAt: null }] }, select: { id: true } }),
      this.prisma.favorite.count({ where: { userId } }),
      this.prisma.question.findMany({ where: { status: 'published', subjectCode: 'nursing' }, select: { id: true, moduleCode: true, moduleName: true, chapter: true } }),
    ])

    const rangeRecords = allRecords.filter((r) => r.createdAt >= rangeStart)
    const totalPractice = allRecords.length
    const correctCount = allRecords.filter((r) => r.isCorrect).length
    const correctRate = totalPractice > 0 ? Math.round((correctCount / totalPractice) * 100) : 0
    const practiceDays = new Set(allRecords.map((r) => r.createdAt.toISOString().slice(0, 10))).size
    const weeklyCount = rangeRecords.length
    const weeklyDays = new Set(rangeRecords.map((r) => r.createdAt.toISOString().slice(0, 10))).size

    const days = range === '7d' ? 7 : 30
    const trendMap = new Map<string, { count: number; correct: number }>()
    for (let i = 0; i < days; i++) {
      const d = new Date(rangeStart)
      d.setDate(rangeStart.getDate() + i)
      trendMap.set(d.toISOString().slice(0, 10), { count: 0, correct: 0 })
    }
    for (const r of rangeRecords) {
      const key = r.createdAt.toISOString().slice(0, 10)
      const day = trendMap.get(key)
      if (day) { day.count++; if (r.isCorrect) day.correct++ }
    }
    const trend = Array.from(trendMap.entries()).map(([date, d]) => ({
      date,
      count: d.count,
      correctRate: d.count > 0 ? Math.round((d.correct / d.count) * 100) : 0,
    }))

    const doneQuestionIds = new Set(allRecords.map((r) => r.questionId))
    const moduleMap = new Map<string, { moduleCode: string; moduleName: string; total: number; done: number; correct: number; practiced: number }>()
    for (const q of questions) {
      const m = moduleMap.get(q.moduleCode) ?? { moduleCode: q.moduleCode, moduleName: q.moduleName, total: 0, done: 0, correct: 0, practiced: 0 }
      m.total++
      if (doneQuestionIds.has(q.id)) m.done++
      moduleMap.set(q.moduleCode, m)
    }
    for (const r of allRecords) {
      const q = questions.find((item) => item.id === r.questionId)
      if (!q) continue
      const m = moduleMap.get(q.moduleCode)
      if (m) { m.practiced++; if (r.isCorrect) m.correct++ }
    }
    const moduleProgress = Array.from(moduleMap.values()).map((m) => ({
      moduleCode: m.moduleCode,
      moduleName: m.moduleName,
      totalQuestions: m.total,
      doneQuestions: m.done,
      completionRate: m.total > 0 ? Math.round((m.done / m.total) * 100) : 0,
      correctRate: m.practiced > 0 ? Math.round((m.correct / m.practiced) * 100) : 0,
    }))

    const chapterMistakes = new Map<string, { chapter: string; moduleName: string; count: number }>()
    for (const m of rangeMistakes) {
      const ch = m.question.chapter || '未分类'
      const existing = chapterMistakes.get(ch) ?? { chapter: ch, moduleName: m.question.moduleName || '', count: 0 }
      existing.count += m.wrongCount
      chapterMistakes.set(ch, existing)
    }
    const weakChapters = Array.from(chapterMistakes.values()).sort((a, b) => b.count - a.count).slice(0, 3)

    const reviewCount = allMistakes.length
    let recommendation = ''
    let recommendAction = ''
    if (reviewCount > 0) {
      recommendation = `今天建议复刷 ${reviewCount} 道错题`
      recommendAction = 'review'
    } else if (weakChapters.length > 0) {
      recommendation = `继续练习薄弱章节「${weakChapters[0].chapter}」`
      recommendAction = 'weak_chapter'
    } else {
      recommendation = '完成今日目标，保持节奏'
      recommendAction = 'daily_goal'
    }

    return {
      summary: { totalPractice, correctRate, practiceDays, weeklyCount, weeklyDays, mistakeCount: rangeMistakes.length, favoriteCount: favorites },
      trend,
      moduleProgress,
      weakChapters,
      reviewCount,
      recommendation,
      recommendAction,
    }
  }
}
