import { Type } from 'class-transformer'
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

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
  @IsNumber()
  @Min(0)
  score?: number
}

export class GradeSessionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeAnswerDto)
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
