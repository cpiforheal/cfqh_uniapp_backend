import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'
import { SubjectCode } from '@prisma/client'

export class CreateExamDto {
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(SubjectCode)
  subjectCode?: SubjectCode

  @IsInt()
  @Min(10)
  @Max(300)
  durationMin: number

  @IsNumber()
  @Min(1)
  totalScore: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxStudents?: number
}

export class UpdateExamDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(300)
  durationMin?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  totalScore?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxStudents?: number
}

export class CreateExamQuestionDto {
  @IsInt()
  @Min(1)
  seq: number

  @IsString()
  type: string

  @IsString()
  stem: string

  @IsOptional()
  @IsString()
  optionsJson?: string

  @IsString()
  answer: string

  @IsOptional()
  @IsString()
  analysis?: string

  @IsNumber()
  @Min(0)
  score: number

  @IsOptional()
  isObjective?: boolean
}
