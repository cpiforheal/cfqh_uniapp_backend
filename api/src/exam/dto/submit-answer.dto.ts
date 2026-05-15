import { IsInt, IsOptional, IsString, Min } from 'class-validator'

export class SubmitAnswerDto {
  @IsString()
  questionId: string

  @IsString()
  answer: string
}

export class HideEventDto {
  @IsInt()
  @Min(0)
  durationMs: number
}

export class GradeAnswerDto {
  @IsString()
  questionId: string

  @IsOptional()
  score?: number
}

export class GradeSessionDto {
  scores: GradeAnswerDto[]

  @IsOptional()
  @IsString()
  comment?: string
}

export class GenerateLicensesDto {
  @IsInt()
  @Min(1)
  count: number
}
