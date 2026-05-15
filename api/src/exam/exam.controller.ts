import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { LicenseGuard } from '../common/guards/license.guard'
import { requireCurrentOpenId } from '../common/current-user'
import { ExamService } from './exam.service'
import { JoinExamDto } from './dto/join-exam.dto'
import { HideEventDto, SubmitAnswerDto } from './dto/submit-answer.dto'

@Controller('exams')
@UseGuards(LicenseGuard)
export class ExamController {
  constructor(
    private readonly examService: ExamService,
    private readonly configService: ConfigService,
  ) {}

  @Post('join')
  join(@Body() dto: JoinExamDto, @Req() req: any) {
    const openId = requireCurrentOpenId(req, this.configService)
    return this.examService.joinExam(dto.code, openId)
  }

  @Get('active')
  active(@Req() req: any) {
    const openId = requireCurrentOpenId(req, this.configService)
    return this.examService.getActiveSession(openId)
  }

  @Get('history')
  history(@Req() req: any) {
    const openId = requireCurrentOpenId(req, this.configService)
    return this.examService.getExamHistory(openId)
  }

  @Get(':sessionId/questions')
  questions(@Param('sessionId') sessionId: string, @Req() req: any) {
    const openId = requireCurrentOpenId(req, this.configService)
    return this.examService.getExamQuestions(sessionId, openId)
  }

  @Post(':sessionId/answer')
  answer(@Param('sessionId') sessionId: string, @Body() dto: SubmitAnswerDto, @Req() req: any) {
    const openId = requireCurrentOpenId(req, this.configService)
    return this.examService.submitAnswer(sessionId, dto.questionId, dto.answer, openId)
  }

  @Post(':sessionId/submit')
  submit(@Param('sessionId') sessionId: string, @Req() req: any) {
    const openId = requireCurrentOpenId(req, this.configService)
    return this.examService.submitExam(sessionId, openId)
  }

  @Post(':sessionId/hide-event')
  hideEvent(@Param('sessionId') sessionId: string, @Body() dto: HideEventDto, @Req() req: any) {
    const openId = requireCurrentOpenId(req, this.configService)
    return this.examService.reportHideEvent(sessionId, dto.durationMs, openId)
  }

  @Get(':sessionId/result')
  result(@Param('sessionId') sessionId: string, @Req() req: any) {
    const openId = requireCurrentOpenId(req, this.configService)
    return this.examService.getExamResult(sessionId, openId)
  }
}
