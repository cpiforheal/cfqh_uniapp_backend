import { IsString } from 'class-validator'

export class JoinExamDto {
  @IsString()
  code: string
}
