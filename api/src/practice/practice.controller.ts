import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { LicenseGuard } from '../common/guards/license.guard'
import { CreateFavoriteDto } from './dto/create-favorite.dto'
import { CreatePracticeRecordDto } from './dto/create-practice-record.dto'
import { PracticeService } from './practice.service'

@UseGuards(LicenseGuard)
@Controller()
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  @Post('practice-records')
  createPracticeRecord(@Body() dto: CreatePracticeRecordDto, @Req() request: Request & { currentOpenId?: string }) {
    return this.practiceService.createRecord(dto, request.currentOpenId!)
  }

  @Get('mistakes')
  mistakes(@Req() request: Request & { currentOpenId?: string }) {
    return this.practiceService.listMistakes(request.currentOpenId!)
  }

  @Post('favorites')
  createFavorite(@Body() dto: CreateFavoriteDto, @Req() request: Request & { currentOpenId?: string }) {
    return this.practiceService.createFavorite(dto, request.currentOpenId!)
  }
}
