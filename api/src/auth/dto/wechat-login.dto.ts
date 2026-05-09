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
}
