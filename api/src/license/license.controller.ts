import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { ConfigService } from '@nestjs/config'
import { requireCurrentOpenId } from '../common/current-user'
import { LicenseService } from './license.service'
import { ActivateLicenseDto } from './dto/activate-license.dto'

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

@Controller('license')
export class LicenseController {
  constructor(
    private readonly licenseService: LicenseService,
    private readonly configService: ConfigService,
  ) {}

  @Post('activate')
  activate(@Body() dto: ActivateLicenseDto, @Req() request: Request) {
    return this.licenseService.activate(dto, requireCurrentOpenId(request, this.configService), {
      clientEnv: dto.clientEnv,
      platform: dto.platform,
      device: dto.device,
      sdkVersion: dto.sdkVersion,
      appVersion: dto.appVersion,
      source: dto.source || 'miniapp',
      ip: firstHeader(request.headers['x-forwarded-for']) || request.ip,
      userAgent: firstHeader(request.headers['user-agent']),
    })
  }

  @Get('status')
  status(@Req() request: Request) {
    return this.licenseService.status(requireCurrentOpenId(request, this.configService))
  }
}
