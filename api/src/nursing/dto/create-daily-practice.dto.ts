import { IsDateString, IsEnum, IsString } from 'class-validator'
import { ContentStatus } from '@prisma/client'

export class CreateDailyPracticeDto {
  @IsDateString()
  date!: string

  @IsString()
  questionId!: string

  @IsEnum(ContentStatus)
  status!: ContentStatus
}
