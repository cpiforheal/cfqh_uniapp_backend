import { IsOptional, IsString } from 'class-validator'

export class ActivateLicenseDto {
  @IsOptional()
  @IsString()
  openId?: string

  @IsString()
  code!: string

  @IsOptional()
  @IsString()
  clientEnv?: string

  @IsOptional()
  @IsString()
  platform?: string

  @IsOptional()
  @IsString()
  device?: string

  @IsOptional()
  @IsString()
  sdkVersion?: string

  @IsOptional()
  @IsString()
  appVersion?: string

  @IsOptional()
  @IsString()
  source?: string
}
