import { Module } from '@nestjs/common'
import { LicenseModule } from '../license/license.module'
import { LicenseGuard } from '../common/guards/license.guard'
import { PracticeController } from './practice.controller'
import { PracticeService } from './practice.service'

@Module({
  imports: [LicenseModule],
  controllers: [PracticeController],
  providers: [PracticeService, LicenseGuard],
})
export class PracticeModule {}
