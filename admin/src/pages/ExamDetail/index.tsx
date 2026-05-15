import { CopyOutlined, DownloadOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Card, Col, Descriptions, Drawer, Form, Input, InputNumber, message, Modal, Popconfirm, Row, Select, Space, Table, Tabs, Tag, Typography, Upload } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { describeAdminFetchError } from '@/services/adminApi'
import {
  getExamDetail, updateExam, addExamQuestion, updateExamQuestion, deleteExamQuestion,
  importExamQuestions, generateExamLicenses, queryExamLicenses, queryExamSessions,
  getExamSessionDetail, gradeExamSession, openExam, closeExam, publishExam,
} from '@/services/adminExam'
import type { ExamDetail, ExamQuestion, ExamLicenseItem, ExamSessionItem, ExamSessionDetail } from '@/services/adminExam'

function getExamIdFromUrl() {
  const hash = window.location.hash || ''
  const match = hash.match(/\/nursing\/exams\/([^/?#]+)/)
  return match?.[1] || ''
}

const questionTypeOptions = [
  { label: '单选题', value: 'single_choice' },
  { label: '多选题', value: 'multiple_choice' },
  { label: '判断题', value: 'judgment' },
  { label: '简答题', value: 'short_answer' },
  { label: '案例分析', value: 'case_analysis' },
]

export default function ExamDetailPage() {
  const examId = getExamIdFromUrl()
  const [exam, setExam] = useState<ExamDetail | null>(null)
  const [licenses, setLicenses] = useState<ExamLicenseItem[]>([])
  const [sessions, setSessions] = useState<ExamSessionItem[]>([])
  const [questionDrawer, setQuestionDrawer] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<ExamQuestion | null>(null)
  const [gradingSession, setGradingSession] = useState<ExamSessionDetail | null>(null)
  const [qForm] = Form.useForm()
  const [gradeForm] = Form.useForm()

  useEffect(() => { if (examId) loadExam() }, [examId])

  async function loadExam() {
    try {
      const data = await getExamDetail(examId)
      setExam(data)
    } catch (err) {
      message.error(describeAdminFetchError(err, '加载失败'))
    }
  }

  async function loadLicenses() {
    try { setLicenses(await queryExamLicenses(examId)) } catch {}
  }

  async function loadSessions() {
    try { setSessions(await queryExamSessions(examId)) } catch {}
  }
  async function handleSaveQuestion(values: any) {
    try {
      if (editingQuestion) {
        await updateExamQuestion(examId, editingQuestion.id, values)
        message.success('已更新')
      } else {
        await addExamQuestion(examId, { ...values, seq: (exam?.questions.length || 0) + 1 })
        message.success('已添加')
      }
      setQuestionDrawer(false)
      setEditingQuestion(null)
      qForm.resetFields()
      loadExam()
    } catch (err) {
      message.error(describeAdminFetchError(err, '保存失败'))
    }
  }

  async function handleDeleteQuestion(qid: string) {
    try {
      await deleteExamQuestion(examId, qid)
      message.success('已删除')
      loadExam()
    } catch (err) {
      message.error(describeAdminFetchError(err, '删除失败'))
    }
  }

  async function handleGenerateLicenses() {
    Modal.confirm({
      title: '生成考试码',
      content: (
        <InputNumber id="gen-count" min={1} max={200} defaultValue={50} style={{ width: '100%' }} />
      ),
      onOk: async () => {
        const input = document.getElementById('gen-count') as HTMLInputElement
        const count = Number(input?.value) || 50
        try {
          const result = await generateExamLicenses(examId, count)
          message.success(`已生成 ${result.generated} 个考试码`)
          loadLicenses()
        } catch (err) {
          message.error(describeAdminFetchError(err, '生成失败'))
        }
      },
    })
  }

  function copyAllCodes() {
    const text = licenses.map((l) => l.code).join('\n')
    navigator.clipboard?.writeText(text)
    message.success(`已复制 ${licenses.length} 个考试码`)
  }

  async function handleOpenGrading(sessionId: string) {
    try {
      const detail = await getExamSessionDetail(examId, sessionId)
      setGradingSession(detail)
      const initialScores: Record<string, number> = {}
      detail.answers.forEach((a) => {
        if (a.score !== null && a.score !== undefined) initialScores[`score_${a.questionId}`] = a.score
      })
      gradeForm.setFieldsValue({ ...initialScores, comment: detail.comment?.content || '' })
    } catch (err) {
      message.error(describeAdminFetchError(err, '加载失败'))
    }
  }

  async function handleGradeSubmit(values: any) {
    if (!gradingSession) return
    const scores = gradingSession.answers
      .filter((a) => !a.question.isObjective)
      .map((a) => ({ questionId: a.questionId, score: values[`score_${a.questionId}`] }))
    try {
      await gradeExamSession(examId, gradingSession.id, { scores, comment: values.comment })
      message.success('批改完成')
      setGradingSession(null)
      gradeForm.resetFields()
      loadSessions()
    } catch (err) {
      message.error(describeAdminFetchError(err, '批改失败'))
    }
  }

  async function handlePublish() {
    try {
      await publishExam(examId)
      message.success('成绩已公布')
      loadExam()
    } catch (err) {
      message.error(describeAdminFetchError(err, '公布失败'))
    }
  }

  if (!exam) return null

  const statusTag = { draft: <Tag color="default">草稿</Tag>, open: <Tag color="green">开放中</Tag>, grading: <Tag color="orange">批改中</Tag>, published: <Tag color="blue">已公布</Tag> }

  return (
    <SubjectAwarePageContainer title={exam.title} content={`状态：${exam.status}`}>
      <Tabs
        defaultActiveKey="info"
        onChange={(key) => { if (key === 'licenses') loadLicenses(); if (key === 'sessions') loadSessions() }}
        items={[
          {
            key: 'info',
            label: '考试信息',
            children: (
              <Card>
                <Descriptions column={2}>
                  <Descriptions.Item label="状态">{statusTag[exam.status as keyof typeof statusTag]}</Descriptions.Item>
                  <Descriptions.Item label="时长">{exam.durationMin} 分钟</Descriptions.Item>
                  <Descriptions.Item label="满分">{exam.totalScore} 分</Descriptions.Item>
                  <Descriptions.Item label="最大考生数">{exam.maxStudents}</Descriptions.Item>
                  <Descriptions.Item label="题目数">{exam.questions.length}</Descriptions.Item>
                  <Descriptions.Item label="描述">{exam.description || '-'}</Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
          {
            key: 'questions',
            label: `题目管理 (${exam.questions.length})`,
            children: (
              <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingQuestion(null); qForm.resetFields(); setQuestionDrawer(true) }}>添加题目</Button>}>
                <Table
                  rowKey="id"
                  dataSource={exam.questions}
                  pagination={false}
                  columns={[
                    { title: '序号', dataIndex: 'seq', width: 60 },
                    { title: '题型', dataIndex: 'type', width: 100, render: (v) => questionTypeOptions.find((o) => o.value === v)?.label || v },
                    { title: '题干', dataIndex: 'stem', ellipsis: true },
                    { title: '分值', dataIndex: 'score', width: 70 },
                    { title: '自动评分', dataIndex: 'isObjective', width: 90, render: (v) => v ? '是' : '否' },
                    {
                      title: '操作', width: 120,
                      render: (_, r) => (
                        <Space>
                          <a onClick={() => { setEditingQuestion(r); qForm.setFieldsValue(r); setQuestionDrawer(true) }}>编辑</a>
                          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteQuestion(r.id)}><a style={{ color: '#ff4d4f' }}>删除</a></Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'licenses',
            label: '考试码',
            children: (
              <Card extra={<Space><Button icon={<PlusOutlined />} onClick={handleGenerateLicenses}>批量生成</Button><Button icon={<CopyOutlined />} onClick={copyAllCodes}>复制全部</Button></Space>}>
                <Table
                  rowKey="id"
                  dataSource={licenses}
                  pagination={{ pageSize: 50 }}
                  columns={[
                    { title: '考试码', dataIndex: 'code', render: (v) => <Typography.Text copyable>{v}</Typography.Text> },
                    { title: '状态', render: (_, r) => r.boundOpenId ? <Tag color="green">已使用</Tag> : <Tag>未使用</Tag> },
                    { title: '绑定用户', dataIndex: 'boundOpenId', render: (v) => v || '-' },
                    { title: '绑定时间', dataIndex: 'boundAt', render: (v) => v ? new Date(v).toLocaleString() : '-' },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'sessions',
            label: '考生批改',
            children: (
              <Card extra={exam.status === 'grading' && <Button type="primary" onClick={handlePublish}>公布成绩</Button>}>
                <Table
                  rowKey="id"
                  dataSource={sessions}
                  pagination={false}
                  columns={[
                    { title: '学生', render: (_, r) => r.user.nickname || r.user.openId.slice(0, 8) },
                    { title: '状态', dataIndex: 'status', render: (v) => ({ in_progress: <Tag>答题中</Tag>, submitted: <Tag color="orange">待批改</Tag>, graded: <Tag color="green">已批改</Tag> }[v as string]) },
                    { title: '客观题分', dataIndex: 'objectiveScore', render: (v) => v ?? '-' },
                    { title: '总分', dataIndex: 'totalScore', render: (v) => v ?? '-' },
                    { title: '排名', dataIndex: 'rank', render: (v) => v ?? '-' },
                    { title: '切后台', dataIndex: 'hideCount' },
                    { title: '交卷时间', dataIndex: 'submittedAt', render: (v) => v ? new Date(v).toLocaleString() : '-' },
                    {
                      title: '操作', render: (_, r) => (
                        <Space>
                          {r.status === 'submitted' && <a onClick={() => handleOpenGrading(r.id)}>批改</a>}
                          {r.status === 'graded' && <a onClick={() => handleOpenGrading(r.id)}>查看</a>}
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />

      <Drawer title={editingQuestion ? '编辑题目' : '添加题目'} open={questionDrawer} onClose={() => setQuestionDrawer(false)} width={600} extra={<Button type="primary" onClick={() => qForm.submit()}>保存</Button>}>
        <Form form={qForm} layout="vertical" onFinish={handleSaveQuestion} preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="type" label="题型" rules={[{ required: true }]} initialValue="single_choice">
                <Select options={questionTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="score" label="分值" rules={[{ required: true }]} initialValue={2}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="stem" label="题干" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="optionsJson" label="选项 JSON" help='格式: [{"key":"A","content":"..."},...]'>
            <Input.TextArea rows={4} placeholder='[{"key":"A","content":"选项A"},{"key":"B","content":"选项B"}]' />
          </Form.Item>
          <Form.Item name="answer" label="正确答案" rules={[{ required: true }]}>
            <Input placeholder="如 A 或 ABC" />
          </Form.Item>
          <Form.Item name="analysis" label="解析">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="isObjective" label="自动评分" initialValue={true}>
            <Select options={[{ label: '是（客观题）', value: true }, { label: '否（主观题）', value: false }]} />
          </Form.Item>
        </Form>
      </Drawer>

      <Modal
        title={`批改 - ${gradingSession?.user.nickname || ''}`}
        open={!!gradingSession}
        onCancel={() => { setGradingSession(null); gradeForm.resetFields() }}
        onOk={() => gradeForm.submit()}
        width={700}
        destroyOnClose
      >
        {gradingSession && (
          <Form form={gradeForm} layout="vertical" onFinish={handleGradeSubmit} preserve={false}>
            {gradingSession.answers.map((a) => (
              <Card key={a.questionId} size="small" style={{ marginBottom: 12 }}>
                <Typography.Text strong>第 {a.question.seq} 题（{a.question.score}分）{a.question.isObjective ? ' [客观]' : ' [主观]'}</Typography.Text>
                <br />
                <Typography.Text type="secondary">{a.question.stem}</Typography.Text>
                <br />
                <Typography.Text>学生答案：{a.answer || '未作答'}</Typography.Text>
                <Typography.Text style={{ marginLeft: 16 }}>正确答案：{a.question.answer}</Typography.Text>
                {!a.question.isObjective && (
                  <Form.Item name={`score_${a.questionId}`} label="给分" style={{ marginTop: 8, marginBottom: 0 }}>
                    <InputNumber min={0} max={a.question.score} />
                  </Form.Item>
                )}
                {a.question.isObjective && (
                  <div style={{ marginTop: 4 }}>
                    <Tag color={a.isCorrect ? 'green' : 'red'}>{a.isCorrect ? '正确' : '错误'} ({a.score ?? 0}分)</Tag>
                  </div>
                )}
              </Card>
            ))}
            <Form.Item name="comment" label="总评">
              <Input.TextArea rows={3} placeholder="给该学生的总体评价" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </SubjectAwarePageContainer>
  )
}
