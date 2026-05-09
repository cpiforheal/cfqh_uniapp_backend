import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { requireCurrentOpenId } from '../current-user'
import { LicenseService } from '../../license/license.service'

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(
    private readonly licenseService: LicenseService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const openId = requireCurrentOpenId(request, this.configService)

    const status = await this.licenseService.status(openId)
    if (!status.authorized) {
      throw new UnauthorizedException('当前账号未激活学习通行码')
    }

    request.currentUser = status
    return true
  }
}
