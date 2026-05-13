import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { AdminRole } from '@prisma/client'

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ currentAdminUser?: { role?: AdminRole } }>()
    if (request.currentAdminUser?.role !== AdminRole.super_admin) {
      throw new ForbiddenException('仅超级管理员可管理老师账号')
    }
    return true
  }
}
