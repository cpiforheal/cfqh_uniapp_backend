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
}
