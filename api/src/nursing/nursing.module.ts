import { Module } from '@nestjs/common'
import { LicenseModule } from '../license/license.module'
import { AdminGuard } from '../common/guards/admin.guard'
import { LicenseGuard } from '../common/guards/license.guard'
import { NursingController } from './nursing.controller'
import { NursingService } from './nursing.service'

@Module({
  imports: [LicenseModule],
  controllers: [NursingController],
  providers: [NursingService, LicenseGuard, AdminGuard],
})
export class NursingModule {}
