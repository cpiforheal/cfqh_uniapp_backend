import { Module } from '@nestjs/common'
import { AdminGuard } from '../common/guards/admin.guard'
import { SuperAdminGuard } from '../common/guards/super-admin.guard'
import { AdminAuthController } from './admin-auth.controller'
import { AdminAuthService } from './admin-auth.service'

@Module({
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminGuard, SuperAdminGuard],
})
export class AdminAuthModule {}
