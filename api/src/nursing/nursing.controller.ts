import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import { requireCurrentOpenId, resolveCurrentOpenId } from '../common/current-user'
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
  moduleQuestions(@Param('moduleCode') moduleCode: string, @Req() request: Request & { currentOpenId?: string }) {
    return this.nursingService.moduleQuestions(moduleCode, request.currentOpenId)
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
  @Post('admin/students/:id/remark')
  updateStudentRemark(@Param('id') id: string, @Body() dto: { remark: string }) {
    return this.nursingService.updateStudentRemark(id, dto.remark)
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
  @Post('admin/questions/batch-publish')
  batchPublishQuestions(@Body() dto: { ids?: string[]; filter?: { status?: string; moduleCode?: string } }) {
    return this.nursingService.batchPublishQuestions(dto)
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

  // === 新增接口 ===

  @Get('home-config')
  homeConfig() {
    return this.nursingService.getHomeConfig()
  }

  @UseGuards(AdminGuard)
  @Get('admin/home-config')
  adminHomeConfig() {
    return this.nursingService.getHomeConfig()
  }

  @UseGuards(AdminGuard)
  @Post('admin/home-config')
  saveHomeConfig(@Body() dto: Record<string, unknown>) {
    return this.nursingService.saveHomeConfig(dto)
  }

  @Get('ranking')
  ranking(@Query('type') type: string, @Req() request: Request) {
    return this.nursingService.getRanking(type || 'days', resolveCurrentOpenId(request, this.configService))
  }

  @Post('video-play-records')
  recordVideoPlay(@Body() dto: { openId?: string; videoId: string }, @Req() request: Request) {
    const openId = dto.openId || resolveCurrentOpenId(request, this.configService)
    return this.nursingService.recordVideoPlay(openId, dto.videoId)
  }

  @UseGuards(AdminGuard)
  @Post('admin/license-tokens/batch-generate')
  batchGenerateLicenseTokens(@Body() dto: { count: number; expiresDays?: number; subjectScope?: string; groupTag?: string }) {
    return this.nursingService.batchGenerateLicenseTokens(dto)
  }

  @UseGuards(AdminGuard)
  @Get('admin/students/:openId')
  adminStudentDetail(@Param('openId') openId: string) {
    return this.nursingService.getStudentDetail(openId)
  }

  @UseGuards(AdminGuard)
  @Get('admin/trends')
  adminTrends(@Query('days') days?: string) {
    return this.nursingService.adminTrends(Number(days) || 7)
  }

  @UseGuards(AdminGuard)
  @Get('admin/alerts')
  adminAlerts() {
    return this.nursingService.adminAlerts()
  }

  @UseGuards(AdminGuard)
  @Get('admin/export/students')
  adminExportStudents() {
    return this.nursingService.adminExportStudents()
  }

  @UseGuards(AdminGuard)
  @Get('admin/export/mistakes')
  adminExportMistakes() {
    return this.nursingService.adminExportMistakes()
  }

  @UseGuards(AdminGuard)
  @Get('admin/groups')
  adminGroups() {
    return this.nursingService.adminGroups()
  }

  @UseGuards(AdminGuard)
  @Get('admin/audit-logs')
  adminAuditLogs(@Query('limit') limit?: string) {
    return this.nursingService.adminAuditLogs(Number(limit) || 50)
  }

  // ─── 带背路由 ─────────────────────────────────────────────────────────────

  @Get('study-cards/modules')
  studyCardModules(@Req() req: Request) {
    const openId = resolveCurrentOpenId(req, this.configService)
    return this.nursingService.studyCardModules(openId)
  }

  @Get('study-cards/modules/:code/questions')
  studyCardModuleQuestions(@Req() req: Request, @Param('code') code: string) {
    const openId = resolveCurrentOpenId(req, this.configService)
    return this.nursingService.studyCardModuleQuestions(code, openId)
  }

  @Get('study-cards/questions/:id')
  studyCardQuestionDetail(@Req() req: Request, @Param('id') id: string) {
    const openId = resolveCurrentOpenId(req, this.configService)
    return this.nursingService.studyCardQuestionDetail(id, openId)
  }

  @Post('study-cards/questions/:id/mastery')
  toggleStudyCardMastery(@Req() req: Request, @Param('id') id: string, @Body('mastered') mastered: boolean) {
    const openId = requireCurrentOpenId(req, this.configService)
    return this.nursingService.toggleStudyCardMastery(openId, id, mastered)
  }

  @Get('study-cards/modules/:code/mastery')
  getModuleMastery(@Req() req: Request, @Param('code') code: string) {
    const openId = requireCurrentOpenId(req, this.configService)
    return this.nursingService.getModuleMastery(openId, code)
  }

  @UseGuards(AdminGuard)
  @Get('admin/study-cards/modules')
  adminStudyCardModules() {
    return this.nursingService.adminStudyCardModules()
  }

  @UseGuards(AdminGuard)
  @Delete('admin/study-cards/modules/:code')
  deleteAdminStudyCardModule(@Param('code') code: string) {
    return this.nursingService.deleteAdminStudyCardModule(code)
  }

  @UseGuards(AdminGuard)
  @Post('admin/study-cards/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 30 * 1024 * 1024 } }))
  previewStudyCardImport(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('请上传 Word 文档')
    return this.nursingService.previewStudyCardImport(file.buffer)
  }

  @UseGuards(AdminGuard)
  @Post('admin/study-cards/import')
  commitStudyCardImport(@Body() dto: Record<string, unknown>) {
    return this.nursingService.commitStudyCardImport(dto as any)
  }

  @UseGuards(AdminGuard)
  @Post('admin/study-cards/modules')
  createAdminStudyCardModule(@Body() dto: { moduleCode: string; moduleName: string; sort?: number; status?: string }) {
    return this.nursingService.createAdminStudyCardModule(dto)
  }

  @UseGuards(AdminGuard)
  @Put('admin/study-cards/modules/:code')
  updateAdminStudyCardModule(@Param('code') code: string, @Body() dto: { moduleName?: string; sort?: number; status?: string }) {
    return this.nursingService.updateAdminStudyCardModule(code, dto)
  }

  @UseGuards(AdminGuard)
  @Get('admin/study-cards/modules/:code/questions')
  adminModuleQuestions(@Param('code') code: string) {
    return this.nursingService.adminModuleQuestions(code)
  }

  @UseGuards(AdminGuard)
  @Post('admin/study-cards/modules/:code/questions')
  createAdminStudyCardQuestion(@Param('code') code: string, @Body() dto: { seq?: number; stem: string; type?: string; options: { key: string; text: string }[]; answer: string }) {
    return this.nursingService.createAdminStudyCardQuestion(code, dto)
  }

  @UseGuards(AdminGuard)
  @Put('admin/study-cards/questions/:id')
  updateAdminStudyCardQuestion(@Param('id') id: string, @Body() dto: { seq?: number; stem?: string; type?: string; options?: { key: string; text: string }[]; answer?: string; status?: string }) {
    return this.nursingService.updateAdminStudyCardQuestion(id, dto)
  }

  @UseGuards(AdminGuard)
  @Delete('admin/study-cards/questions/:id')
  deleteAdminStudyCardQuestion(@Param('id') id: string) {
    return this.nursingService.deleteAdminStudyCardQuestion(id)
  }

  @UseGuards(AdminGuard)
  @Post('admin/study-cards/questions/:id/knowledge-cards')
  createAdminKnowledgeCard(@Param('id') id: string, @Body() dto: { title: string; body: unknown[] }) {
    return this.nursingService.createAdminKnowledgeCard(id, dto)
  }

  @UseGuards(AdminGuard)
  @Put('admin/study-cards/knowledge-cards/:id')
  updateAdminKnowledgeCard(@Param('id') id: string, @Body() dto: { title?: string; body?: unknown[] }) {
    return this.nursingService.updateAdminKnowledgeCard(id, dto)
  }

  @UseGuards(AdminGuard)
  @Delete('admin/study-cards/knowledge-cards/:id')
  deleteAdminKnowledgeCard(@Param('id') id: string) {
    return this.nursingService.deleteAdminKnowledgeCard(id)
  }

  @UseGuards(AdminGuard)
  @Post('admin/study-cards/license-tokens/batch-generate')
  batchGenerateStudyCardTokens(@Body() dto: { count: number; expiresDays?: number; groupTag?: string }) {
    return this.nursingService.batchGenerateStudyCardTokens(dto)
  }

  @UseGuards(AdminGuard)
  @Get('admin/study-cards/license-tokens')
  queryStudyCardTokens(@Query('keyword') keyword?: string) {
    return this.nursingService.queryStudyCardTokens(keyword)
  }

  @UseGuards(AdminGuard)
  @Post('admin/study-cards/license-tokens/:id/disable')
  disableStudyCardToken(@Param('id') id: string) {
    return this.nursingService.disableStudyCardToken(id)
  }

  @UseGuards(AdminGuard)
  @Post('admin/study-cards/license-tokens/:id/extend')
  extendStudyCardToken(@Param('id') id: string, @Body('days') days: number) {
    return this.nursingService.extendStudyCardToken(id, days)
  }
}
