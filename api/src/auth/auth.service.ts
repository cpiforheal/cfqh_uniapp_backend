import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import { requireLoginOpenId, resolveTrustedOpenId } from '../common/current-user'
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
    if (dto.code) {
      try {
        return await this.exchangeWechatCode(dto.code)
      } catch (error) {
        const trustedOpenId = resolveTrustedOpenId(request, this.configService)
        if (trustedOpenId) return trustedOpenId
        throw error
      }
    }
    return requireLoginOpenId(request, this.configService)
  }

  private firstHeader(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
  }

  private cleanText(value?: string, fallback?: string) {
    const trimmed = String(value || '').trim()
    return trimmed || fallback
  }

  async wechatLogin(dto: WechatLoginDto, request: Request) {
    const openId = await this.resolveLoginOpenId(dto, request)
    const nickname = this.cleanText(dto.nickname)
    const avatarUrl = this.cleanText(dto.avatarUrl)
    const clientEnv = this.cleanText(dto.clientEnv)
    const platform = this.cleanText(dto.platform)
    const device = this.cleanText(dto.device)
    const sdkVersion = this.cleanText(dto.sdkVersion)
    const appVersion = this.cleanText(dto.appVersion)
    const source = this.cleanText(dto.source, 'miniapp')
    const ip = this.firstHeader(request.headers['x-forwarded-for']) || request.ip
    const userAgent = this.firstHeader(request.headers['user-agent'])

    const user = await this.prisma.user.upsert({
      where: { openId },
      update: {
        nickname,
        avatarUrl,
        loginCount: { increment: 1 },
        lastLoginAt: new Date(),
        lastClientEnv: clientEnv,
        lastPlatform: platform,
        lastDevice: device,
        lastSdkVersion: sdkVersion,
      },
      create: {
        openId,
        nickname: nickname || '微信用户',
        avatarUrl,
        loginCount: 1,
        lastLoginAt: new Date(),
        lastClientEnv: clientEnv,
        lastPlatform: platform,
        lastDevice: device,
        lastSdkVersion: sdkVersion,
      },
      include: { authorization: { include: { licenseToken: true } } },
    })
    const logNickname = nickname || user.nickname || '微信用户'
    await this.prisma.userLoginLog.create({
      data: {
        userId: user.id,
        openId,
        nickname: logNickname,
        clientEnv,
        platform,
        device,
        sdkVersion,
        appVersion,
        source,
        ip,
        userAgent,
      },
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
