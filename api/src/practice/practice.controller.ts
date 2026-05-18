import { Body, Controller, Delete, Get, Post, Query, Req, UseGuards } from '@nestjs/common'
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

  @Delete('practice-records/chapter')
  resetChapterRecords(
    @Query('moduleCode') moduleCode: string,
    @Query('chapter') chapter: string,
    @Req() request: Request & { currentOpenId?: string },
  ) {
    return this.practiceService.resetChapterRecords(request.currentOpenId!, moduleCode, chapter)
  }

  @Get('mistakes')
  mistakes(@Req() request: Request & { currentOpenId?: string }) {
    return this.practiceService.listMistakes(request.currentOpenId!)
  }

  @Get('favorites')
  favorites(@Req() request: Request & { currentOpenId?: string }) {
    return this.practiceService.listFavorites(request.currentOpenId!)
  }

  @Post('favorites')
  createFavorite(@Body() dto: CreateFavoriteDto, @Req() request: Request & { currentOpenId?: string }) {
    return this.practiceService.createFavorite(dto, request.currentOpenId!)
  }

  @Delete('favorites')
  removeFavorite(@Query('questionId') questionId: string, @Req() request: Request & { currentOpenId?: string }) {
    return this.practiceService.removeFavorite(questionId, request.currentOpenId!)
  }

  @Get('my/report')
  learningReport(@Req() request: Request & { currentOpenId?: string }) {
    return this.practiceService.learningReport(request.currentOpenId!)
  }

  @Get('my/review-today')
  reviewToday(@Req() request: Request & { currentOpenId?: string }) {
    return this.practiceService.reviewToday(request.currentOpenId!)
  }

  @Get('my/learning-report')
  learningReport2(@Query('range') range?: string, @Req() request?: Request & { currentOpenId?: string }) {
    const validRange = range === '30d' || range === 'all' ? range : '7d'
    return this.practiceService.learningReportFull(request!.currentOpenId!, validRange)
  }
}
