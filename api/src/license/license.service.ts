import { Injectable, NotFoundException } from '@nestjs/common'
import { LicenseStatus, SubjectCode } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ActivateLicenseDto } from './dto/activate-license.dto'

type ActivationAttemptMetadata = {
  clientEnv?: string
  platform?: string
  device?: string
  sdkVersion?: string
  appVersion?: string
  source?: string
  ip?: string
  userAgent?: string
}

@Injectable()
export class LicenseService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureUser(openId: string) {
    return this.prisma.user.upsert({
      where: { openId },
      update: {},
      create: {
        openId,
        nickname: '微信用户',
        loginCount: 0,
        lastLoginAt: new Date(),
        lastClientEnv: 'miniapp',
      },
    })
  }

  private normalizeLicenseCode(input: string) {
    const trimmed = String(input || '').trim().toUpperCase()
    const compact = trimmed.replace(/[^A-Z0-9]/g, '')
    const candidates = new Set<string>()
    if (trimmed) candidates.add(trimmed)
    if (compact) {
      candidates.add(compact)
      if (compact.startsWith('NUR') && compact.length > 3) candidates.add(`NUR-${compact.slice(3)}`)
      if (compact.length === 8) candidates.add(`NUR-${compact}`)
    }
    return Array.from(candidates)
  }

  private cleanText(value?: string) {
    const trimmed = String(value || '').trim()
    return trimmed || undefined
  }

  private async recordActivationAttempt(params: {
    dto: ActivateLicenseDto
    openId: string
    userId?: string
    token?: {
      id: string
      status: LicenseStatus
    } | null
    codeNormalized?: string
    result: 'success' | 'failed'
    reason: string
    metadata?: ActivationAttemptMetadata
  }) {
    try {
      await this.prisma.licenseActivationAttempt.create({
        data: {
          codeInput: String(params.dto.code || '').trim(),
          codeNormalized: params.codeNormalized,
          tokenId: params.token?.id,
          userId: params.userId,
          openId: params.openId,
          result: params.result,
          reason: params.reason,
          tokenStatus: params.token?.status,
          clientEnv: this.cleanText(params.metadata?.clientEnv),
          platform: this.cleanText(params.metadata?.platform),
          device: this.cleanText(params.metadata?.device),
          sdkVersion: this.cleanText(params.metadata?.sdkVersion),
          appVersion: this.cleanText(params.metadata?.appVersion),
          source: this.cleanText(params.metadata?.source),
          ip: this.cleanText(params.metadata?.ip),
          userAgent: this.cleanText(params.metadata?.userAgent),
        },
      })
    } catch (error) {
      console.warn('record license activation attempt failed', error)
    }
  }

  async activate(dto: ActivateLicenseDto, openId: string, metadata?: ActivationAttemptMetadata) {
    const user = await this.ensureUser(openId)

    const codeCandidates = this.normalizeLicenseCode(dto.code)
    const token = await this.prisma.licenseToken.findFirst({ where: { code: { in: codeCandidates } } })
    const codeNormalized = token?.code || codeCandidates[0]
    if (!token) {
      await this.recordActivationAttempt({ dto, openId, userId: user.id, codeNormalized, result: 'failed', reason: 'not_found', metadata })
      return { authorized: false, reason: 'not_found', authorization: null }
    }
    const expired = Boolean(token.expiresAt && token.expiresAt <= new Date())
    if (token.status === LicenseStatus.disabled) {
      await this.recordActivationAttempt({ dto, openId, userId: user.id, token, codeNormalized, result: 'failed', reason: 'disabled', metadata })
      return { authorized: false, reason: 'disabled', authorization: null }
    }
    if (token.status === LicenseStatus.expired || expired) {
      await this.recordActivationAttempt({ dto, openId, userId: user.id, token, codeNormalized, result: 'failed', reason: 'expired', metadata })
      return { authorized: false, reason: 'expired', authorization: null }
    }
    if (token.boundOpenId && token.boundOpenId !== openId) {
      await this.recordActivationAttempt({ dto, openId, userId: user.id, token, codeNormalized, result: 'failed', reason: 'bound_to_other_account', metadata })
      return { authorized: false, reason: 'bound_to_other_account', authorization: null }
    }

    await this.prisma.userAuthorization.upsert({
      where: { userId: user.id },
      update: {
        licenseTokenId: token.id,
        subjectScope: token.subjectScope,
        resourceScope: token.resourceScope,
        expiresAt: token.expiresAt,
      },
      create: {
        userId: user.id,
        licenseTokenId: token.id,
        subjectScope: token.subjectScope,
        resourceScope: token.resourceScope,
        expiresAt: token.expiresAt,
      },
    })

    await this.prisma.licenseToken.update({
      where: { id: token.id },
      data: {
        status: LicenseStatus.bound,
        boundUserId: user.id,
        boundOpenId: openId,
        boundAt: new Date(),
      },
    })
    await this.prisma.licenseToken.updateMany({
      where: {
        boundOpenId: openId,
        status: LicenseStatus.bound,
        id: { not: token.id },
      },
      data: { status: LicenseStatus.disabled },
    })

    await this.recordActivationAttempt({ dto, openId, userId: user.id, token, codeNormalized, result: 'success', reason: 'authorized', metadata })
    return this.status(openId)
  }

  async status(openId: string, subjectScope: SubjectCode = SubjectCode.nursing) {
    await this.ensureUser(openId)
    const user = await this.prisma.user.findUnique({
      where: { openId },
      include: { authorization: { include: { licenseToken: true } } },
    })
    if (!user) throw new NotFoundException('用户不存在')

    const authorization = user.authorization
    const now = new Date()
    const token = authorization?.licenseToken
    const expired = Boolean(authorization?.expiresAt && authorization.expiresAt <= now) || Boolean(token?.expiresAt && token.expiresAt <= now)
    const disabled = token?.status === LicenseStatus.disabled
    const subjectMatched = authorization?.subjectScope === subjectScope && token?.subjectScope === subjectScope
    const boundToCurrentUser = !token?.boundOpenId || token.boundOpenId === openId
    const authorized = Boolean(authorization && token && !expired && !disabled && subjectMatched && boundToCurrentUser)

    return {
      userId: user.id,
      openId: user.openId,
      authorized,
      reason: authorized
        ? 'authorized'
        : !authorization
          ? 'not_activated'
          : expired
            ? 'expired'
            : disabled
              ? 'disabled'
              : !subjectMatched
                ? 'subject_mismatch'
                : !boundToCurrentUser
                  ? 'bound_to_other_account'
                  : 'unauthorized',
      authorization,
    }
  }
}
