import { Global, Module } from '@nestjs/common'
import { AdminContextService } from '../common/admin-context'
import { PrismaService } from './prisma.service'

@Global()
@Module({
  providers: [PrismaService, AdminContextService],
  exports: [PrismaService, AdminContextService],
})
export class PrismaModule {}
