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
        isCorrect: dto.isCorrect,
        practiceMode: dto.practiceMode || 'daily',
        sequenceNo: dto.sequenceNo,
        totalCount: dto.totalCount,
      },
    })

    if (!dto.isCorrect) {
      await this.prisma.mistake.upsert({
        where: { userId_questionId: { userId, questionId: dto.questionId } },
        update: { wrongCount: { increment: 1 } },
        create: {
          userId,
          questionId: dto.questionId,
          wrongCount: 1,
        },
      })
    }

    return record
  }

  async listMistakes(openId: string) {
    const userId = await this.getUserId(openId)
    return this.prisma.mistake.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
  }

  async createFavorite(dto: CreateFavoriteDto, openId: string) {
    const userId = await this.getUserId(openId)
    return this.prisma.favorite.upsert({
      where: { userId_questionId: { userId, questionId: dto.questionId } },
      update: {},
      create: {
        userId,
        questionId: dto.questionId,
      },
    })
  }
}
