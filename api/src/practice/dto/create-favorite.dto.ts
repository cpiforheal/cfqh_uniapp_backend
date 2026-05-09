import { IsOptional, IsString } from 'class-validator'

export class CreateFavoriteDto {
  @IsOptional()
  @IsString()
  openId?: string

  @IsString()
  questionId!: string
}
