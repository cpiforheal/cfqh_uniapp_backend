import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import { requireLoginOpenId } from '../common/current-user'
import { PrismaService } from '../prisma/prisma.service'
import { WechatLoginDto } from './dto/wechat-login.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private async exchangeWechatCode(code: string) {
    const appId = this.configService.get<string>('WECHAT_APP_ID')
    const appSecret = this.configService.get<string>('WECHAT_APP_SECRET')
    if (!appId || !appSecret) {
      throw new BadRequestException('未配置微信 AppId/AppSecret，无法使用 code 登录')
    }

    const params = new URLSearchParams({
      appid: appId,
      secret: appSecret,
      js_code: code,
      grant_type: 'authorization_code',
    })
    const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params.toString()}`)
    const result = await response.json() as { openid?: string; errmsg?: string; errcode?: number }
    if (!response.ok || !result.openid) {
      throw new BadRequestException(result.errmsg || `微信 code 换取 openId 失败：${result.errcode || response.status}`)
    }

    return result.openid
  }

  private async resolveLoginOpenId(dto: WechatLoginDto, request: Request) {
    if (dto.code) return this.exchangeWechatCode(dto.code)
    return requireLoginOpenId(request, this.configService)
  }

  async wechatLogin(dto: WechatLoginDto, request: Request) {
    const openId = await this.resolveLoginOpenId(dto, request)
    const user = await this.prisma.user.upsert({
      where: { openId },
      update: { nickname: dto.nickname, avatarUrl: dto.avatarUrl },
      create: { openId, nickname: dto.nickname, avatarUrl: dto.avatarUrl },
      include: { authorization: { include: { licenseToken: true } } },
    })
    return user
  }

  async me(request: Request) {
    const openId = requireLoginOpenId(request, this.configService)
    const user = await this.prisma.user.findUnique({
      where: { openId },
      include: { authorization: { include: { licenseToken: true } } },
    })
    if (!user) throw new NotFoundException('用户不存在')
    return user
  }
}
