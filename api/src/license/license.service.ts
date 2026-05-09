import { Injectable, NotFoundException } from '@nestjs/common'
import { LicenseStatus, SubjectCode } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ActivateLicenseDto } from './dto/activate-license.dto'

@Injectable()
export class LicenseService {
  constructor(private readonly prisma: PrismaService) {}

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

  async activate(dto: ActivateLicenseDto, openId: string) {
    const user = await this.prisma.user.findUnique({ where: { openId } })
    if (!user) throw new NotFoundException('用户不存在，请先登录')

    const codeCandidates = this.normalizeLicenseCode(dto.code)
    const token = await this.prisma.licenseToken.findFirst({ where: { code: { in: codeCandidates } } })
    if (!token) return { authorized: false, reason: 'not_found', authorization: null }
    const expired = Boolean(token.expiresAt && token.expiresAt <= new Date())
    if (token.status === LicenseStatus.disabled) return { authorized: false, reason: 'disabled', authorization: null }
    if (token.status === LicenseStatus.expired || expired) return { authorized: false, reason: 'expired', authorization: null }
    if (token.boundOpenId && token.boundOpenId !== openId) return { authorized: false, reason: 'bound_to_other_account', authorization: null }

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

    return this.status(openId)
  }

  async status(openId: string, subjectScope: SubjectCode = SubjectCode.nursing) {
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
