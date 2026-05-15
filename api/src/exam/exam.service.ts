import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { ExamSessionStatus, ExamStatus, QuestionType } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateExamDto, CreateExamQuestionDto, UpdateExamDto } from './dto/create-exam.dto'
import { GradeSessionDto } from './dto/submit-answer.dto'

@Injectable()
export class ExamService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Admin ──────────────────────────────────────────────────────────────────

  async createExam(dto: CreateExamDto) {
    return this.prisma.exam.create({
      data: {
        title: dto.title,
        description: dto.description,
        subjectCode: dto.subjectCode || 'nursing',
        durationMin: dto.durationMin,
        totalScore: dto.totalScore,
        maxStudents: dto.maxStudents || 100,
      },
    })
  }

  async listExams() {
    const exams = await this.prisma.exam.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true, sessions: true, licenses: true } },
      },
    })
    return exams.map((e) => ({
      ...e,
      questionCount: e._count.questions,
      studentCount: e._count.sessions,
      licenseCount: e._count.licenses,
      _count: undefined,
    }))
  }

  async getExamDetail(examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: { orderBy: { seq: 'asc' } } },
    })
    if (!exam) throw new NotFoundException('考试不存在')
    return exam
  }
  async updateExam(examId: string, dto: UpdateExamDto) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) throw new NotFoundException('考试不存在')
    if (exam.status !== ExamStatus.draft) throw new BadRequestException('只能编辑草稿状态的考试')
    return this.prisma.exam.update({ where: { id: examId }, data: dto })
  }

  async deleteExam(examId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) throw new NotFoundException('考试不存在')
    if (exam.status !== ExamStatus.draft) throw new BadRequestException('只能删除草稿状态的考试')
    await this.prisma.exam.delete({ where: { id: examId } })
    return { ok: true }
  }

  async addQuestion(examId: string, dto: CreateExamQuestionDto) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) throw new NotFoundException('考试不存在')
    return this.prisma.examQuestion.create({
      data: {
        examId,
        seq: dto.seq,
        type: dto.type as QuestionType,
        stem: dto.stem,
        optionsJson: dto.optionsJson || '[]',
        answer: dto.answer,
        analysis: dto.analysis,
        score: dto.score,
        isObjective: dto.isObjective ?? true,
      },
    })
  }

  async updateQuestion(examId: string, questionId: string, dto: Partial<CreateExamQuestionDto>) {
    const q = await this.prisma.examQuestion.findFirst({ where: { id: questionId, examId } })
    if (!q) throw new NotFoundException('题目不存在')
    return this.prisma.examQuestion.update({
      where: { id: questionId },
      data: {
        ...(dto.seq !== undefined && { seq: dto.seq }),
        ...(dto.type && { type: dto.type as QuestionType }),
        ...(dto.stem && { stem: dto.stem }),
        ...(dto.optionsJson && { optionsJson: dto.optionsJson }),
        ...(dto.answer && { answer: dto.answer }),
        ...(dto.analysis !== undefined && { analysis: dto.analysis }),
        ...(dto.score !== undefined && { score: dto.score }),
        ...(dto.isObjective !== undefined && { isObjective: dto.isObjective }),
      },
    })
  }

  async deleteQuestion(examId: string, questionId: string) {
    const q = await this.prisma.examQuestion.findFirst({ where: { id: questionId, examId } })
    if (!q) throw new NotFoundException('题目不存在')
    await this.prisma.examQuestion.delete({ where: { id: questionId } })
    return { ok: true }
  }

  async importQuestions(examId: string, questions: CreateExamQuestionDto[]) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) throw new NotFoundException('考试不存在')
    const data = questions.map((q) => ({
      examId,
      seq: q.seq,
      type: q.type as QuestionType,
      stem: q.stem,
      optionsJson: q.optionsJson || '[]',
      answer: q.answer,
      analysis: q.analysis || null,
      score: q.score,
      isObjective: q.isObjective ?? true,
    }))
    await this.prisma.examQuestion.createMany({ data })
    return { imported: data.length }
  }

  async generateLicenses(examId: string, count: number) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) throw new NotFoundException('考试不存在')
    const codes: string[] = []
    for (let i = 0; i < count; i++) {
      codes.push(this.generateExamCode())
    }
    await this.prisma.examLicense.createMany({
      data: codes.map((code) => ({ code, examId })),
    })
    return { generated: codes.length, codes }
  }

  async listLicenses(examId: string) {
    return this.prisma.examLicense.findMany({
      where: { examId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async openExam(examId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId }, include: { _count: { select: { questions: true } } } })
    if (!exam) throw new NotFoundException('考试不存在')
    if (exam._count.questions === 0) throw new BadRequestException('考试没有题目，无法开放')
    return this.prisma.exam.update({ where: { id: examId }, data: { status: ExamStatus.open } })
  }

  async closeExam(examId: string) {
    return this.prisma.exam.update({ where: { id: examId }, data: { status: ExamStatus.grading } })
  }

  async listSessions(examId: string) {
    return this.prisma.examSession.findMany({
      where: { examId },
      include: { user: { select: { nickname: true, openId: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getSessionDetail(examId: string, sessionId: string) {
    const session = await this.prisma.examSession.findFirst({
      where: { id: sessionId, examId },
      include: {
        user: { select: { nickname: true, openId: true } },
        answers: { include: { question: true } },
        comment: true,
      },
    })
    if (!session) throw new NotFoundException('考试会话不存在')
    return session
  }

  async gradeSession(examId: string, sessionId: string, dto: GradeSessionDto, adminUserId?: string) {
    const session = await this.prisma.examSession.findFirst({
      where: { id: sessionId, examId, status: ExamSessionStatus.submitted },
    })
    if (!session) throw new NotFoundException('未找到待批改的考试会话')

    for (const item of dto.scores) {
      await this.prisma.examAnswer.updateMany({
        where: { sessionId, questionId: item.questionId },
        data: { score: item.score },
      })
    }

    const allAnswers = await this.prisma.examAnswer.findMany({ where: { sessionId } })
    const subjectiveScore = allAnswers
      .filter((a) => a.score !== null && a.isCorrect === null)
      .reduce((sum, a) => sum + (a.score || 0), 0)
    const objectiveScore = session.objectiveScore || 0
    const totalScore = objectiveScore + subjectiveScore

    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { subjectiveScore, totalScore, status: ExamSessionStatus.graded },
    })

    if (dto.comment) {
      await this.prisma.examComment.upsert({
        where: { sessionId },
        update: { content: dto.comment, createdBy: adminUserId },
        create: { sessionId, content: dto.comment, createdBy: adminUserId },
      })
    }

    return { ok: true, totalScore }
  }

  async publishExam(examId: string) {
    const sessions = await this.prisma.examSession.findMany({
      where: { examId, status: { in: [ExamSessionStatus.graded, ExamSessionStatus.submitted] } },
      orderBy: [{ totalScore: 'desc' }, { submittedAt: 'asc' }],
    })

    let rank = 0
    let prevScore: number | null = null
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i]
      if (s.totalScore !== prevScore) rank = i + 1
      prevScore = s.totalScore
      await this.prisma.examSession.update({ where: { id: s.id }, data: { rank } })
    }

    await this.prisma.exam.update({ where: { id: examId }, data: { status: ExamStatus.published } })
    return { ok: true, totalStudents: sessions.length }
  }

  // ─── Student ────────────────────────────────────────────────────────────────

  async joinExam(code: string, openId: string) {
    const candidates = this.normalizeExamCode(code)
    const license = await this.prisma.examLicense.findFirst({
      where: { code: { in: candidates } },
      include: { exam: true },
    })
    if (!license) throw new NotFoundException('考试码无效')
    if (license.boundOpenId) throw new BadRequestException('该考试码已被使用')
    if (license.exam.status !== ExamStatus.open) throw new BadRequestException('考试未开放或已结束')

    const sessionCount = await this.prisma.examSession.count({ where: { examId: license.examId } })
    if (sessionCount >= license.exam.maxStudents) throw new BadRequestException('考试人数已满')

    const user = await this.ensureUser(openId)

    const existing = await this.prisma.examSession.findFirst({
      where: { examId: license.examId, userId: user.id },
    })
    if (existing) throw new BadRequestException('你已参加过此考试')

    await this.prisma.examLicense.update({
      where: { id: license.id },
      data: { boundUserId: user.id, boundOpenId: openId, boundAt: new Date() },
    })

    const session = await this.prisma.examSession.create({
      data: { examId: license.examId, userId: user.id, licenseId: license.id },
    })

    return {
      sessionId: session.id,
      exam: {
        id: license.exam.id,
        title: license.exam.title,
        durationMin: license.exam.durationMin,
        totalScore: license.exam.totalScore,
      },
      startedAt: session.startedAt.toISOString(),
      deadline: new Date(session.startedAt.getTime() + license.exam.durationMin * 60000).toISOString(),
    }
  }

  async getActiveSession(openId: string) {
    const user = await this.prisma.user.findUnique({ where: { openId } })
    if (!user) return null
    const session = await this.prisma.examSession.findFirst({
      where: { userId: user.id, status: ExamSessionStatus.in_progress },
      include: { exam: true },
    })
    if (!session) return null
    const deadline = new Date(session.startedAt.getTime() + session.exam.durationMin * 60000)
    if (deadline < new Date()) {
      await this.autoSubmit(session.id)
      return null
    }
    return {
      sessionId: session.id,
      exam: { id: session.exam.id, title: session.exam.title, durationMin: session.exam.durationMin, totalScore: session.exam.totalScore },
      startedAt: session.startedAt.toISOString(),
      deadline: deadline.toISOString(),
    }
  }
  async getExamQuestions(sessionId: string, openId: string) {
    const session = await this.verifySessionOwner(sessionId, openId)
    const questions = await this.prisma.examQuestion.findMany({
      where: { examId: session.examId },
      orderBy: { seq: 'asc' },
      select: { id: true, seq: true, type: true, stem: true, optionsJson: true, score: true, isObjective: true },
    })
    const answers = await this.prisma.examAnswer.findMany({
      where: { sessionId },
      select: { questionId: true, answer: true },
    })
    const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]))
    return questions.map((q) => ({ ...q, savedAnswer: answerMap.get(q.id) || null }))
  }

  async submitAnswer(sessionId: string, questionId: string, answer: string, openId: string) {
    const session = await this.verifySessionOwner(sessionId, openId)
    if (session.status !== ExamSessionStatus.in_progress) throw new BadRequestException('考试已结束')

    const deadline = new Date(session.startedAt.getTime() + session.exam.durationMin * 60000 + 30000)
    if (new Date() > deadline) throw new BadRequestException('答题时间已过')

    await this.prisma.examAnswer.upsert({
      where: { sessionId_questionId: { sessionId, questionId } },
      update: { answer },
      create: { sessionId, questionId, answer },
    })
    return { ok: true }
  }

  async submitExam(sessionId: string, openId: string) {
    const session = await this.verifySessionOwner(sessionId, openId)
    if (session.status !== ExamSessionStatus.in_progress) throw new BadRequestException('已交卷')
    return this.autoSubmit(sessionId)
  }

  async reportHideEvent(sessionId: string, durationMs: number, openId: string) {
    await this.verifySessionOwner(sessionId, openId)
    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { hideCount: { increment: 1 }, hideDurationMs: { increment: durationMs } },
    })
    return { ok: true }
  }

  async getExamResult(sessionId: string, openId: string) {
    const session = await this.verifySessionOwner(sessionId, openId)
    if (session.exam.status !== ExamStatus.published) {
      return { published: false, status: session.status, examTitle: session.exam.title }
    }
    const totalStudents = await this.prisma.examSession.count({ where: { examId: session.examId } })
    const comment = await this.prisma.examComment.findUnique({ where: { sessionId } })
    const answers = await this.prisma.examAnswer.findMany({
      where: { sessionId },
      include: { question: true },
    })
    return {
      published: true,
      examTitle: session.exam.title,
      totalScore: session.totalScore,
      objectiveScore: session.objectiveScore,
      subjectiveScore: session.subjectiveScore,
      rank: session.rank,
      totalStudents,
      hideCount: session.hideCount,
      comment: comment?.content || null,
      answers: answers.map((a) => ({
        questionId: a.questionId,
        seq: a.question.seq,
        stem: a.question.stem,
        type: a.question.type,
        yourAnswer: a.answer,
        correctAnswer: a.question.answer,
        isCorrect: a.isCorrect,
        score: a.score,
        maxScore: a.question.score,
        analysis: a.question.analysis,
      })),
    }
  }

  async getExamHistory(openId: string) {
    const user = await this.prisma.user.findUnique({ where: { openId } })
    if (!user) return []
    return this.prisma.examSession.findMany({
      where: { userId: user.id },
      include: { exam: { select: { id: true, title: true, status: true, totalScore: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async autoSubmit(sessionId: string) {
    const answers = await this.prisma.examAnswer.findMany({
      where: { sessionId },
      include: { question: true },
    })

    let objectiveScore = 0
    for (const a of answers) {
      if (a.question.isObjective) {
        const isCorrect = this.normalizeAnswer(a.answer || '') === this.normalizeAnswer(a.question.answer)
        const score = isCorrect ? a.question.score : 0
        objectiveScore += score
        await this.prisma.examAnswer.update({
          where: { id: a.id },
          data: { isCorrect, score },
        })
      }
    }

    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { status: ExamSessionStatus.submitted, submittedAt: new Date(), objectiveScore },
    })
    return { ok: true, objectiveScore }
  }

  private async verifySessionOwner(sessionId: string, openId: string) {
    const user = await this.prisma.user.findUnique({ where: { openId } })
    if (!user) throw new ForbiddenException('用户不存在')
    const session = await this.prisma.examSession.findFirst({
      where: { id: sessionId, userId: user.id },
      include: { exam: true },
    })
    if (!session) throw new NotFoundException('考试会话不存在')
    return session
  }

  private ensureUser(openId: string) {
    return this.prisma.user.upsert({
      where: { openId },
      update: {},
      create: { openId, nickname: '微信用户', loginCount: 0, lastLoginAt: new Date(), lastClientEnv: 'miniapp' },
    })
  }

  private normalizeExamCode(input: string) {
    const trimmed = String(input || '').trim().toUpperCase()
    const compact = trimmed.replace(/[^A-Z0-9]/g, '')
    const candidates = new Set<string>()
    if (trimmed) candidates.add(trimmed)
    if (compact) {
      candidates.add(compact)
      if (compact.startsWith('EXM') && compact.length > 3) candidates.add(`EXM-${compact.slice(3)}`)
      if (compact.length === 8) candidates.add(`EXM-${compact}`)
    }
    return Array.from(candidates)
  }

  private normalizeAnswer(answer: string) {
    return String(answer || '').trim().toUpperCase().split('').sort().join('')
  }

  private generateExamCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return `EXM-${code}`
  }
}
