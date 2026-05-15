import { Module } from '@nestjs/common'
import { LicenseModule } from '../license/license.module'
import { AdminGuard } from '../common/guards/admin.guard'
import { LicenseGuard } from '../common/guards/license.guard'
import { ExamController } from './exam.controller'
import { ExamAdminController } from './exam-admin.controller'
import { ExamService } from './exam.service'
import { ExamImportService } from './exam-import.service'

@Module({
  imports: [LicenseModule],
  controllers: [ExamController, ExamAdminController],
  providers: [ExamService, ExamImportService, LicenseGuard, AdminGuard],
})
export class ExamModule {}
