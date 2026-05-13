import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { AdminGuard } from '../common/guards/admin.guard'
import { SuperAdminGuard } from '../common/guards/super-admin.guard'
import { AdminAuthService } from './admin-auth.service'

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getSessionToken(request: Request) {
  const bearer = firstHeader(request.headers.authorization)?.replace(/^Bearer\s+/i, '').trim()
  return firstHeader(request.headers['x-admin-session']) || bearer
}

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  login(@Body() dto: { username?: string; password?: string }, @Req() request: Request) {
    return this.adminAuthService.login(dto, {
      ip: firstHeader(request.headers['x-forwarded-for']) || request.ip,
      userAgent: firstHeader(request.headers['user-agent']),
    })
  }

  @Get('me')
  me(@Req() request: Request) {
    return this.adminAuthService.getSessionUser(getSessionToken(request))
  }

  @Post('logout')
  logout(@Req() request: Request) {
    return this.adminAuthService.logout(getSessionToken(request))
  }

  @UseGuards(AdminGuard, SuperAdminGuard)
  @Get('users')
  users() {
    return this.adminAuthService.listAdminUsers()
  }

  @UseGuards(AdminGuard, SuperAdminGuard)
  @Post('users')
  createTeacher(@Body() dto: { username?: string; password?: string }) {
    return this.adminAuthService.createTeacher(dto)
  }

  @UseGuards(AdminGuard, SuperAdminGuard)
  @Post('users/:id/reset-password')
  resetTeacherPassword(@Param('id') id: string, @Body() dto: { password?: string }) {
    return this.adminAuthService.resetTeacherPassword(id, dto)
  }

  @UseGuards(AdminGuard, SuperAdminGuard)
  @Delete('users/:id')
  disableTeacher(@Param('id') id: string) {
    return this.adminAuthService.disableTeacher(id)
  }
}
