import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { assertProductionEnv } from './common/production-env'
import { PrismaService } from './prisma/prisma.service'

async function bootstrap() {
  assertProductionEnv()

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false })
  app.useBodyParser('json', { limit: '10mb' })
  app.useBodyParser('urlencoded', { extended: true, limit: '10mb' })
  app.setGlobalPrefix('api')
  app.enableCors()
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  const config = new DocumentBuilder().setTitle('CFQH Procedure API').setDescription('医护授权与只读内容 API').setVersion('0.1.0').build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  const prismaService = app.get(PrismaService)
  await prismaService.enableShutdownHooks(app)

  await app.listen(process.env.PORT ?? 3001)
}
bootstrap()
