import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>()
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production'
    const configuredToken = this.configService.get<string>('ADMIN_TOKEN') || (isProduction ? '' : 'cfqh-admin-dev-token')
    const headerToken = request.headers['x-admin-token']
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken

    if (!token || token !== configuredToken) {
      throw new UnauthorizedException('后台访问令牌无效')
    }

    return true
  }
}
