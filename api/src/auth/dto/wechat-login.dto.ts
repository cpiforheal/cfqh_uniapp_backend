import { IsOptional, IsString } from 'class-validator'

export class WechatLoginDto {
  @IsOptional()
  @IsString()
  openId?: string

  @IsOptional()
  @IsString()
  code?: string

  @IsOptional()
  @IsString()
  nickname?: string

  @IsOptional()
  @IsString()
  avatarUrl?: string

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
