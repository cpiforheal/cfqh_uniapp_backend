import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import { resolveCurrentOpenId } from '../common/current-user'
import { AdminGuard } from '../common/guards/admin.guard'
import { LicenseGuard } from '../common/guards/license.guard'
import { CreateDailyPracticeDto } from './dto/create-daily-practice.dto'
import { NursingService } from './nursing.service'

function normalizeUploadedFilename(filename?: string) {
  const fallback = '题目文档.docx'
  if (!filename) return fallback
  if (!/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßà-ÿ]/.test(filename)) return filename
  return Buffer.from(filename, 'latin1').toString('utf8')
}

@Controller()
export class NursingController {
  constructor(
    private readonly nursingService: NursingService,
    private readonly configService: ConfigService,
  ) {}

  @Get('catalog')
  catalog(@Req() request: Request) {
    return this.nursingService.catalog(resolveCurrentOpenId(request, this.configService))
  }

  @UseGuards(LicenseGuard)
  @Get('knowledge-points')
  knowledgePoints() {
    return this.nursingService.knowledgePoints()
  }

  @UseGuards(LicenseGuard)
  @Get('questions')
  questions(@Query('moduleCode') moduleCode?: string) {
    return this.nursingService.questions(moduleCode)
  }

  @UseGuards(LicenseGuard)
  @Get('modules/:moduleCode/questions')
  moduleQuestions(@Param('moduleCode') moduleCode: string) {
    return this.nursingService.moduleQuestions(moduleCode)
  }

  @UseGuards(LicenseGuard)
  @Get('modules/:moduleCode/videos')
  moduleVideos(@Param('moduleCode') moduleCode: string) {
    return this.nursingService.moduleVideos(moduleCode)
  }

  @UseGuards(LicenseGuard)
  @Get('questions/:id')
  questionDetail(@Param('id') id: string, @Req() request: Request & { currentOpenId?: string }) {
    return this.nursingService.questionDetail(id, request.currentOpenId)
  }

  @UseGuards(LicenseGuard)
  @Get('case-materials')
  caseMaterials() {
    return this.nursingService.caseMaterials()
  }

  @UseGuards(LicenseGuard)
  @Get('confusing-points')
  confusingPoints() {
    return this.nursingService.confusingPoints()
  }

  @UseGuards(LicenseGuard)
  @Get('memory-tips')
  memoryTips() {
    return this.nursingService.memoryTips()
  }

  @UseGuards(LicenseGuard)
  @Get('daily-practice')
  dailyPractice() {
    return this.nursingService.dailyPractice()
  }

  @UseGuards(LicenseGuard)
  @Get('practice-home')
  practiceHome(@Req() request: Request & { currentOpenId?: string }) {
    return this.nursingService.practiceHome(request.currentOpenId)
  }

  @UseGuards(LicenseGuard)
  @Get('videos')
  videos(@Query('moduleCode') moduleCode?: string) {
    return this.nursingService.videos(moduleCode)
  }

  @UseGuards(AdminGuard)
  @Get('admin/analytics')
  adminAnalytics() {
    return this.nursingService.adminAnalytics()
  }

  @UseGuards(AdminGuard)
  @Get('admin/visibility')
  adminVisibility() {
    return this.nursingService.adminVisibility()
  }

  @UseGuards(AdminGuard)
  @Get('admin/assets')
  adminAssets() {
    return this.nursingService.adminAssets()
  }

  @UseGuards(AdminGuard)
  @Post('admin/assets')
  upsertAdminAsset(@Body() dto: Record<string, unknown>) {
    return this.nursingService.upsertAdminAsset(dto)
  }

  @UseGuards(AdminGuard)
  @Delete('admin/assets/:id')
  deleteAdminAsset(@Param('id') id: string) {
    return this.nursingService.deleteAdminAsset(id)
  }

  @UseGuards(AdminGuard)
  @Get('admin/students')
  adminStudents(@Query('keyword') keyword?: string) {
    return this.nursingService.adminStudents(keyword)
  }

  @UseGuards(AdminGuard)
  @Get('admin/login-users')
  adminLoginUsers(@Query('keyword') keyword?: string) {
    return this.nursingService.adminLoginUsers(keyword)
  }

  @UseGuards(AdminGuard)
  @Get('admin/license-tokens')
  adminLicenseTokens(@Query('keyword') keyword?: string, @Query('status') status?: string) {
    return this.nursingService.adminLicenseTokens(keyword, status)
  }

  @UseGuards(AdminGuard)
  @Post('admin/license-tokens/issue')
  issueLicenseToken(@Body() dto: Record<string, unknown>) {
    return this.nursingService.issueLicenseToken(dto)
  }

  @UseGuards(AdminGuard)
  @Post('admin/license-tokens/:id/disable')
  disableLicenseToken(@Param('id') id: string) {
    return this.nursingService.disableLicenseToken(id)
  }

  @UseGuards(AdminGuard)
  @Post('admin/license-tokens/:id/extend')
  extendLicenseToken(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.nursingService.extendLicenseToken(id, dto)
  }

  @UseGuards(AdminGuard)
  @Delete('admin/license-tokens/:id')
  deleteLicenseToken(@Param('id') id: string) {
    return this.nursingService.deleteLicenseToken(id)
  }

  @UseGuards(AdminGuard)
  @Get('admin/questions')
  adminQuestions() {
    return this.nursingService.adminQuestions()
  }

  @UseGuards(AdminGuard)
  @Post('admin/questions')
  upsertAdminQuestion(@Body() dto: Record<string, unknown>) {
    return this.nursingService.upsertAdminQuestion(dto)
  }

  @UseGuards(AdminGuard)
  @Post('admin/question-imports/preview')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'questionDoc', maxCount: 1 },
    { name: 'answerDoc', maxCount: 1 },
  ], { limits: { fileSize: 30 * 1024 * 1024 } }))
  previewQuestionImport(@UploadedFiles() files: { questionDoc?: Express.Multer.File[]; answerDoc?: Express.Multer.File[] }) {
    const questionDoc = files.questionDoc?.[0]
    if (!questionDoc) throw new BadRequestException('请上传题目 Word 文档')
    return this.nursingService.previewQuestionImport(
      questionDoc.buffer,
      normalizeUploadedFilename(questionDoc.originalname),
      files.answerDoc?.[0]?.buffer,
    )
  }

  @UseGuards(AdminGuard)
  @Post('admin/question-imports/commit')
  commitQuestionImport(@Body() dto: Record<string, unknown>) {
    return this.nursingService.commitQuestionImport(dto)
  }

  @UseGuards(AdminGuard)
  @Delete('admin/questions/:id')
  deleteAdminQuestion(@Param('id') id: string) {
    return this.nursingService.deleteAdminQuestion(id)
  }

  @UseGuards(AdminGuard)
  @Get('admin/videos')
  adminVideos() {
    return this.nursingService.adminVideos()
  }

  @UseGuards(AdminGuard)
  @Post('admin/vod/upload-signature')
  vodUploadSignature() {
    return this.nursingService.createVodUploadSignature()
  }

  @UseGuards(AdminGuard)
  @Post('admin/videos')
  upsertAdminVideo(@Body() dto: Record<string, unknown>) {
    return this.nursingService.upsertAdminVideo(dto)
  }

  @UseGuards(AdminGuard)
  @Delete('admin/videos/:id')
  deleteAdminVideo(@Param('id') id: string) {
    return this.nursingService.deleteAdminVideo(id)
  }

  @UseGuards(AdminGuard)
  @Get('admin/daily-practice')
  adminDailyPractice() {
    return this.nursingService.adminDailyPractice()
  }

  @UseGuards(AdminGuard)
  @Post('admin/daily-practice')
  upsertDailyPractice(@Body() dto: CreateDailyPracticeDto) {
    return this.nursingService.upsertDailyPractice(dto)
  }
}
