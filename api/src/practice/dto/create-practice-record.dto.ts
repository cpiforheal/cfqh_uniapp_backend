import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator'

export class CreatePracticeRecordDto {
  @IsOptional()
  @IsString()
  openId?: string

  @IsString()
  questionId!: string

  @IsOptional()
  @IsString()
  submittedAnswer?: string

  @IsOptional()
  @IsString()
  selectedOption?: string

  @IsBoolean()
  isCorrect!: boolean

  @IsOptional()
  @IsString()
  practiceMode?: string

  @IsOptional()
  @IsInt()
  sequenceNo?: number

  @IsOptional()
  @IsInt()
  totalCount?: number

  @IsOptional()
  @IsInt()
  durationMs?: number

  @IsOptional()
  @IsString()
  sessionId?: string

  @IsOptional()
  @IsString()
  reviewFrequency?: string
}
