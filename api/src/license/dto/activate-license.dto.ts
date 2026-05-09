import { IsOptional, IsString } from 'class-validator'

export class ActivateLicenseDto {
  @IsOptional()
  @IsString()
  openId?: string

  @IsString()
  code!: string
}
