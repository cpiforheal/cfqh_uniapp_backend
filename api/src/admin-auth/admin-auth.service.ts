import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { AdminRole, AdminUser, AdminUserStatus } from '@prisma/client'
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'
import { AdminContextService } from '../common/admin-context'
import { PrismaService } from '../prisma/prisma.service'

const DEFAULT_SUPER_USERNAME = 'admin'
const DEFAULT_SUPER_PASSWORD = '123456cfqh'
const SESSION_DAYS = 30

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const iterations = 120000
  const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex')
  return `pbkdf2$${iterations}$${salt}$${hash}`
}

function verifyPassword(password: string, passwordHash: string) {
  const [scheme, iterationsText, salt, expectedHash] = passwordHash.split('$')
  if (scheme !== 'pbkdf2' || !iterationsText || !salt || !expectedHash) return false
  const iterations = Number(iterationsText)
  if (!Number.isFinite(iterations) || iterations <= 0) return false
  const actual = Buffer.from(pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex'))
  const expected = Buffer.from(expectedHash)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function sanitizeAdminUser(user: AdminUser) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminContext: AdminContextService,
  ) {}

  private async ensureDefaultSuperAdmin() {
    const superAdminCount = await this.prisma.adminUser.count({
      where: { role: AdminRole.super_admin },
    })
    if (superAdminCount > 0) return

    const existingAdmin = await this.prisma.adminUser.findUnique({
      where: { username: DEFAULT_SUPER_USERNAME },
    })
    if (existingAdmin) {
      await this.prisma.adminUser.update({
        where: { id: existingAdmin.id },
        data: {
          passwordHash: hashPassword(DEFAULT_SUPER_PASSWORD),
          role: AdminRole.super_admin,
          status: AdminUserStatus.active,
        },
      })
      return
    }

    await this.prisma.adminUser.create({
      data: {
        username: DEFAULT_SUPER_USERNAME,
        passwordHash: hashPassword(DEFAULT_SUPER_PASSWORD),
        role: AdminRole.super_admin,
        status: AdminUserStatus.active,
      },
    })
  }

  private async recordAudit(action: string, target?: string, detail?: Record<string, unknown>) {
    const currentAdmin = this.adminContext.getCurrentAdmin()
    await this.prisma.adminAuditLog.create({
      data: {
        action,
        target,
        detail: detail ? JSON.stringify(detail) : undefined,
        operatorId: currentAdmin?.id === 'legacy-admin' ? undefined : currentAdmin?.id,
        operator: currentAdmin?.username || 'admin',
      },
    })
  }

  async login(dto: { username?: string; password?: string }, metadata?: { ip?: string; userAgent?: string }) {
    await this.ensureDefaultSuperAdmin()
    const username = String(dto.username || '').trim()
    const password = String(dto.password || '')
    if (!username || !password) throw new BadRequestException('请输入后台账号和密码')

    const user = await this.prisma.adminUser.findUnique({ where: { username } })
    if (!user || user.status !== AdminUserStatus.active || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('后台账号或密码错误')
    }

    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
    await this.prisma.$transaction([
      this.prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      this.prisma.adminSession.create({
        data: {
          tokenHash: hashToken(token),
          adminUserId: user.id,
          expiresAt,
          lastUsedAt: new Date(),
        },
      }),
      this.prisma.adminAuditLog.create({
        data: {
          action: 'admin.login',
          target: user.id,
          operatorId: user.id,
          operator: user.username,
          ip: metadata?.ip,
          detail: metadata?.userAgent ? JSON.stringify({ userAgent: metadata.userAgent }) : undefined,
        },
      }),
    ])

    return {
      token,
      expiresAt,
      user: sanitizeAdminUser({ ...user, lastLoginAt: new Date() }),
    }
  }

  async getSessionUser(token?: string) {
    if (!token) throw new UnauthorizedException('后台登录已失效，请重新登录')
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { adminUser: true },
    })
    if (!session || session.expiresAt <= new Date() || session.adminUser.status !== AdminUserStatus.active) {
      throw new UnauthorizedException('后台登录已失效，请重新登录')
    }
    return sanitizeAdminUser(session.adminUser)
  }

  async logout(token?: string) {
    if (token) {
      await this.prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } })
    }
    return { ok: true }
  }

  async listAdminUsers() {
    await this.ensureDefaultSuperAdmin()
    const users = await this.prisma.adminUser.findMany({ orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] })
    return users.map(sanitizeAdminUser)
  }

  async createTeacher(dto: { username?: string; password?: string }) {
    const username = String(dto.username || '').trim()
    const password = String(dto.password || '')
    if (!/^[a-zA-Z0-9_@.-]{3,32}$/.test(username)) throw new BadRequestException('账号需为 3-32 位字母、数字或 _ @ . -')
    if (password.length < 8) throw new BadRequestException('密码至少 8 位')

    const existed = await this.prisma.adminUser.findUnique({ where: { username } })
    if (existed) throw new ConflictException('该后台账号已存在')
    const created = await this.prisma.adminUser.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        role: AdminRole.teacher,
        status: AdminUserStatus.active,
      },
    })
    await this.recordAudit('admin_user.create_teacher', created.id, { username })
    return sanitizeAdminUser(created)
  }

  async resetTeacherPassword(id: string, dto: { password?: string }) {
    const password = String(dto.password || '')
    if (password.length < 8) throw new BadRequestException('密码至少 8 位')
    const user = await this.prisma.adminUser.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('老师账号不存在')
    if (user.role !== AdminRole.teacher) throw new BadRequestException('仅可重置普通老师账号')

    const updated = await this.prisma.adminUser.update({
      where: { id },
      data: { passwordHash: hashPassword(password) },
    })
    await this.prisma.adminSession.deleteMany({ where: { adminUserId: id } })
    await this.recordAudit('admin_user.reset_password', id, { username: updated.username })
    return sanitizeAdminUser(updated)
  }

  async disableTeacher(id: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('老师账号不存在')
    if (user.role !== AdminRole.teacher) throw new BadRequestException('仅可删除普通老师账号')

    const updated = await this.prisma.adminUser.update({
      where: { id },
      data: { status: AdminUserStatus.disabled },
    })
    await this.prisma.adminSession.deleteMany({ where: { adminUserId: id } })
    await this.recordAudit('admin_user.disable_teacher', id, { username: updated.username })
    return sanitizeAdminUser(updated)
  }
}
