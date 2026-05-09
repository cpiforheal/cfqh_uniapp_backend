import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { ConfigService } from '@nestjs/config'
import { requireCurrentOpenId } from '../common/current-user'
import { LicenseService } from './license.service'
import { ActivateLicenseDto } from './dto/activate-license.dto'

@Controller('license')
export class LicenseController {
  constructor(
    private readonly licenseService: LicenseService,
    private readonly configService: ConfigService,
  ) {}

  @Post('activate')
  activate(@Body() dto: ActivateLicenseDto, @Req() request: Request) {
    return this.licenseService.activate(dto, requireCurrentOpenId(request, this.configService))
  }

  @Get('status')
  status(@Req() request: Request) {
    return this.licenseService.status(requireCurrentOpenId(request, this.configService))
  }
}
