import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import { WechatLoginDto } from './dto/wechat-login.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wechat-login')
  wechatLogin(@Body() dto: WechatLoginDto, @Req() request: Request) {
    return this.authService.wechatLogin(dto, request)
  }

  @Get('me')
  me(@Req() request: Request) {
    return this.authService.me(request)
  }

  @Post('update-profile')
  updateProfile(@Body() dto: { nickname?: string; realName?: string; className?: string; phoneTail?: string; wechatId?: string }, @Req() request: Request) {
    return this.authService.updateProfile(request, dto)
  }
}
