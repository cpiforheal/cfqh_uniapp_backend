import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AdminGuard } from '../common/guards/admin.guard'
import { ExamService } from './exam.service'
import { ExamImportService } from './exam-import.service'
import { CreateExamDto, CreateExamQuestionDto, UpdateExamDto } from './dto/create-exam.dto'
import { GenerateLicensesDto, GradeSessionDto } from './dto/submit-answer.dto'

@Controller('admin/exams')
@UseGuards(AdminGuard)
export class ExamAdminController {
  constructor(
    private readonly examService: ExamService,
    private readonly examImportService: ExamImportService,
  ) {}

  @Post()
  create(@Body() dto: CreateExamDto) {
    return this.examService.createExam(dto)
  }

  @Get()
  list() {
    return this.examService.listExams()
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.examService.getExamDetail(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateExamDto) {
    return this.examService.updateExam(id, dto)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.examService.deleteExam(id)
  }

  @Post(':id/questions')
  addQuestion(@Param('id') id: string, @Body() dto: CreateExamQuestionDto) {
    return this.examService.addQuestion(id, dto)
  }

  @Patch(':id/questions/:qid')
  updateQuestion(@Param('id') id: string, @Param('qid') qid: string, @Body() dto: Partial<CreateExamQuestionDto>) {
    return this.examService.updateQuestion(id, qid, dto)
  }

  @Delete(':id/questions/:qid')
  deleteQuestion(@Param('id') id: string, @Param('qid') qid: string) {
    return this.examService.deleteQuestion(id, qid)
  }

  @Post(':id/import')
  importQuestions(@Param('id') id: string, @Body() body: { questions: CreateExamQuestionDto[] }) {
    return this.examService.importQuestions(id, body.questions)
  }

  @Post(':id/licenses/generate')
  generateLicenses(@Param('id') id: string, @Body() dto: GenerateLicensesDto) {
    return this.examService.generateLicenses(id, dto.count)
  }

  @Get(':id/licenses')
  listLicenses(@Param('id') id: string) {
    return this.examService.listLicenses(id)
  }

  @Post(':id/open')
  open(@Param('id') id: string) {
    return this.examService.openExam(id)
  }

  @Post(':id/close')
  close(@Param('id') id: string) {
    return this.examService.closeExam(id)
  }

  @Get(':id/sessions')
  listSessions(@Param('id') id: string) {
    return this.examService.listSessions(id)
  }

  @Get(':id/sessions/:sid')
  sessionDetail(@Param('id') id: string, @Param('sid') sid: string) {
    return this.examService.getSessionDetail(id, sid)
  }

  @Post(':id/sessions/:sid/grade')
  gradeSession(@Param('id') id: string, @Param('sid') sid: string, @Body() dto: GradeSessionDto, @Req() req: any) {
    return this.examService.gradeSession(id, sid, dto, req.currentAdminUser?.id)
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.examService.publishExam(id)
  }
}
