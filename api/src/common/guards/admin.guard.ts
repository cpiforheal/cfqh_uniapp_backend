import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AdminRole, AdminUserStatus } from '@prisma/client'
import { createHash } from 'node:crypto'
import { AdminContextService } from '../admin-context'
import { PrismaService } from '../../prisma/prisma.service'

type AdminRequest = {
  headers: Record<string, string | string[] | undefined>
  currentAdminUser?: {
    id: string
    username: string
    role: AdminRole
  }
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly adminContext: AdminContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>()
    const bearer = firstHeader(request.headers.authorization)?.replace(/^Bearer\s+/i, '').trim()
    const sessionToken = firstHeader(request.headers['x-admin-session']) || bearer
    if (sessionToken) {
      const session = await this.prisma.adminSession.findUnique({
        where: { tokenHash: hashToken(sessionToken) },
        include: { adminUser: true },
      })
      if (session && session.expiresAt > new Date() && session.adminUser.status === AdminUserStatus.active) {
        const currentAdminUser = {
          id: session.adminUser.id,
          username: session.adminUser.username,
          role: session.adminUser.role,
        }
        request.currentAdminUser = currentAdminUser
        this.adminContext.setCurrentAdmin(currentAdminUser)
        await this.prisma.adminSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined)
        return true
      }
    }

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production'
    const configuredToken = this.configService.get<string>('ADMIN_TOKEN') || (isProduction ? '' : 'cfqh-admin-dev-token')
    const headerToken = request.headers['x-admin-token']
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken

    if (token && token === configuredToken) {
      const currentAdminUser = {
        id: 'legacy-admin',
        username: 'legacy-admin',
        role: AdminRole.super_admin,
      }
      request.currentAdminUser = currentAdminUser
      this.adminContext.setCurrentAdmin(currentAdminUser)
      return true
    }

    throw new UnauthorizedException('后台登录已失效，请重新登录')
  }
}
