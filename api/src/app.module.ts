import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AdminAuthModule } from './admin-auth/admin-auth.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { ExamModule } from './exam/exam.module'
import { LicenseModule } from './license/license.module'
import { NursingModule } from './nursing/nursing.module'
import { PracticeModule } from './practice/practice.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, AdminAuthModule, LicenseModule, NursingModule, PracticeModule, ExamModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
