import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>
  body?: Record<string, unknown>
  query?: Record<string, unknown>
  currentOpenId?: string
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function isProduction(configService: ConfigService) {
  return configService.get<string>('NODE_ENV') === 'production'
}

export function isDevOpenIdAllowed(configService: ConfigService) {
  return !isProduction(configService) && configService.get<string>('ALLOW_DEV_OPEN_ID') === 'true'
}

export function resolveTrustedOpenId(request: RequestLike, configService: ConfigService) {
  const headers = request.headers || {}
  const openId = firstHeader(headers['x-open-id'])
  const secret = firstHeader(headers['x-gateway-secret'])
  const configuredSecret = configService.get<string>('GATEWAY_SECRET')

  if (openId && configuredSecret && secret === configuredSecret) {
    request.currentOpenId = openId
    return openId
  }

  if (openId && isDevOpenIdAllowed(configService)) {
    request.currentOpenId = openId
    return openId
  }

  return undefined
}

export function resolveCurrentOpenId(request: RequestLike, configService: ConfigService) {
  const trustedOpenId = resolveTrustedOpenId(request, configService)
  if (trustedOpenId) return trustedOpenId

  if (isDevOpenIdAllowed(configService)) {
    const bodyOpenId = typeof request.body?.openId === 'string' ? request.body.openId : undefined
    const queryOpenId = typeof request.query?.openId === 'string' ? request.query.openId : undefined
    const devOpenId = configService.get<string>('DEV_OPEN_ID')
    const openId = bodyOpenId || queryOpenId || devOpenId
    if (openId) {
      request.currentOpenId = openId
      return openId
    }
  }

  return undefined
}

export function requireCurrentOpenId(request: RequestLike, configService: ConfigService) {
  const openId = resolveCurrentOpenId(request, configService)
  if (!openId) {
    throw new UnauthorizedException('缺少可信用户授权标识')
  }
  return openId
}

export function requireLoginOpenId(request: RequestLike, configService: ConfigService) {
  const openId = resolveCurrentOpenId(request, configService)
  if (!openId) {
    throw new BadRequestException('缺少登录凭证 code 或可信 openId')
  }
  return openId
}
