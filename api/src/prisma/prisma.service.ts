import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect()
    const dbUrl = process.env.DATABASE_URL || ''
    if (dbUrl.includes('file:') || dbUrl.includes('sqlite')) {
      await this.$queryRawUnsafe('PRAGMA journal_mode=WAL')
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close()
    })
  }
}
