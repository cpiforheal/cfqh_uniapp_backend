import { CopyOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Col, Descriptions, Drawer, Empty, Form, Input, InputNumber, message, Modal, Popconfirm, Row, Select, Space, Table, Tabs, Tag, Typography, Upload } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { describeAdminFetchError } from '@/services/adminApi'
import {
  getExamDetail, updateExam, addExamQuestion, updateExamQuestion, deleteExamQuestion,
  importExamQuestions, previewExamQuestionImport, generateExamLicenses, queryExamLicenses, queryExamSessions,
  createTestSubmission, getExamSessionDetail, gradeExamSession, openExam, closeExam, publishExam,
} from '@/services/adminExam'
import type { ExamDetail, ExamQuestion, ExamLicenseItem, ExamSessionItem, ExamSessionDetail, ExamQuestionImportPreview } from '@/services/adminExam'

function getExamIdFromUrl() {
  const pathnameMatch = window.location.pathname.match(/\/nursing\/exams\/([^/?#]+)/)
  if (pathnameMatch?.[1] && pathnameMatch[1] !== 'list') return decodeURIComponent(pathnameMatch[1])

  const hash = window.location.hash || ''
  const match = hash.match(/\/nursing\/exams\/([^/?#]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

const questionTypeOptions = [
  { label: '单选题', value: 'single_choice' },
  { label: '多选题', value: 'multiple_choice' },
  { label: '判断题', value: 'judgment' },
  { label: '简答题', value: 'short_answer' },
  { label: '案例分析', value: 'case_analysis' },
]

function formatOptionsJson(value?: string) {
  try {
    const options = JSON.parse(value || '[]') as Array<{ key?: string; content?: string }>
    return options.map((option) => `${option.key || ''}.${option.content || ''}`).join('\n')
  } catch {
    return value || '-'
  }
}

export default function ExamDetailPage() {
  const examId = getExamIdFromUrl()
  const [exam, setExam] = useState<ExamDetail | null>(null)
  const [licenses, setLicenses] = useState<ExamLicenseItem[]>([])
  const [sessions, setSessions] = useState<ExamSessionItem[]>([])
  const [activeTab, setActiveTab] = useState('info')
  const [questionDrawer, setQuestionDrawer] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<ExamQuestion | null>(null)
  const [gradingSession, setGradingSession] = useState<ExamSessionDetail | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File>()
  const [importPreview, setImportPreview] = useState<ExamQuestionImportPreview>()
  const [previewingImport, setPreviewingImport] = useState(false)
  const [importingQuestions, setImportingQuestions] = useState(false)
  const [qForm] = Form.useForm()
  const [gradeForm] = Form.useForm()

  useEffect(() => {
    if (!examId) return
    loadExam()
    loadLicenses()
  }, [examId])

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

  function switchTab(key: string) {
    setActiveTab(key)
    if (key === 'licenses') loadLicenses()
    if (key === 'sessions') loadSessions()
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

  async function handlePreviewImport() {
    if (!importFile) {
      message.warning('请先选择题目 Word 文档')
      return
    }
    setPreviewingImport(true)
    try {
      const preview = await previewExamQuestionImport(examId, importFile)
      setImportPreview(preview)
      if (preview.summary.total === 0) message.warning('未识别到题目，请检查题号、选项和答案格式')
      else message.success(`已识别 ${preview.summary.total} 道题`)
    } catch (err) {
      message.error(describeAdminFetchError(err, '解析失败'))
    } finally {
      setPreviewingImport(false)
    }
  }

  async function handleImportPreviewItems() {
    if (!exam || !importPreview?.items.length) return
    setImportingQuestions(true)
    try {
      const offset = exam.questions.length
      const questions = importPreview.items.map((item, index) => ({
        seq: offset + index + 1,
        type: item.type || 'single_choice',
        stem: item.stem || '',
        optionsJson: item.optionsJson || '[]',
        answer: item.answer || '',
        analysis: item.analysis,
        score: Number(item.score) || 0,
        isObjective: item.isObjective ?? true,
      }))
      const result = await importExamQuestions(examId, questions)
      message.success(`已导入 ${result.imported} 道题目，请在题目列表复核后再开放考试`)
      closeImportModal()
      loadExam()
    } catch (err) {
      message.error(describeAdminFetchError(err, '导入失败'))
    } finally {
      setImportingQuestions(false)
    }
  }

  function closeImportModal() {
    setImportOpen(false)
    setImportFile(undefined)
    setImportPreview(undefined)
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

  async function handleOpenExam() {
    try {
      await openExam(examId)
      message.success('考试已开放')
      loadExam()
    } catch (err) {
      message.error(describeAdminFetchError(err, '开放失败'))
    }
  }

  async function handleCloseExam() {
    try {
      await closeExam(examId)
      message.success('已关闭，进入批改阶段')
      loadExam()
      loadSessions()
    } catch (err) {
      message.error(describeAdminFetchError(err, '关闭失败'))
    }
  }

  async function handleCreateTestSubmission() {
    try {
      await createTestSubmission(examId)
      message.success('已生成一份测试答卷')
      loadSessions()
      switchTab('sessions')
    } catch (err) {
      message.error(describeAdminFetchError(err, '生成测试答卷失败'))
    }
  }

  if (!examId) {
    return (
      <SubjectAwarePageContainer title="考试详情">
        <Empty description="未找到考试 ID" />
      </SubjectAwarePageContainer>
    )
  }

  if (!exam) {
    return (
      <SubjectAwarePageContainer title="考试详情">
        <Card loading />
      </SubjectAwarePageContainer>
    )
  }

  const statusTag = { draft: <Tag color="default">草稿</Tag>, open: <Tag color="green">开放中</Tag>, grading: <Tag color="orange">批改中</Tag>, published: <Tag color="blue">已公布</Tag> }
  const canOpen = exam.status === 'draft' && exam.questions.length > 0
  const nextStep = (() => {
    if (exam.status === 'draft' && exam.questions.length === 0) {
      return { message: '下一步：先添加题目，草稿有题后才能开放考试。', action: <Button type="primary" onClick={() => switchTab('questions')}>去添加题目</Button> }
    }
    if (exam.status === 'draft' && licenses.length === 0) {
      return { message: '下一步：生成考试码，供小程序端考生进入考试。', action: <Button type="primary" onClick={() => switchTab('licenses')}>去生成考试码</Button> }
    }
    if (exam.status === 'draft') {
      return { message: '下一步：开放考试，然后把考试码发给考生。', action: <Button type="primary" onClick={handleOpenExam}>开放考试</Button> }
    }
    if (exam.status === 'open') {
      return { message: '考试开放中：可用考试码在小程序端答题，也可先生成一份测试答卷验证后台闭环。', action: <Button type="primary" onClick={handleCreateTestSubmission}>生成测试答卷</Button> }
    }
    if (exam.status === 'grading') {
      return { message: '下一步：批改已提交答卷，全部批改后公布成绩。', action: <Button type="primary" onClick={() => switchTab('sessions')}>去批改</Button> }
    }
    return { message: '流程已完成：成绩已公布，考生可查看结果。', action: <Button onClick={() => switchTab('sessions')}>查看成绩</Button> }
  })()

  return (
    <SubjectAwarePageContainer
      title={exam.title}
      content={`状态：${exam.status}`}
      extra={[
        <Button key="back" onClick={() => window.location.assign('/nursing/exams/list')}>返回列表</Button>,
        exam.status === 'draft' ? <Button key="open" type="primary" disabled={!canOpen} onClick={handleOpenExam}>开放考试</Button> : null,
        exam.status === 'open' ? <Button key="test-submission" onClick={handleCreateTestSubmission}>生成测试答卷</Button> : null,
        exam.status === 'open' ? <Button key="close" danger onClick={handleCloseExam}>关闭考试</Button> : null,
        exam.status === 'grading' ? <Button key="publish" type="primary" onClick={handlePublish}>公布成绩</Button> : null,
      ].filter(Boolean)}
    >
      <Tabs
        activeKey={activeTab}
        onChange={switchTab}
        items={[
          {
            key: 'info',
            label: '考试信息',
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Alert
                  type="info"
                  showIcon
                  message={nextStep.message}
                  action={nextStep.action}
                />
                <Card>
                  <Descriptions column={2}>
                    <Descriptions.Item label="状态">{statusTag[exam.status as keyof typeof statusTag]}</Descriptions.Item>
                    <Descriptions.Item label="时长">{exam.durationMin} 分钟</Descriptions.Item>
                    <Descriptions.Item label="满分">{exam.totalScore} 分</Descriptions.Item>
                    <Descriptions.Item label="最大考生数">{exam.maxStudents}</Descriptions.Item>
                    <Descriptions.Item label="题目数">{exam.questions.length}</Descriptions.Item>
                    <Descriptions.Item label="考试码">{licenses.length}</Descriptions.Item>
                    <Descriptions.Item label="描述">{exam.description || '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Space>
            ),
          },
          {
            key: 'questions',
            label: `题目管理 (${exam.questions.length})`,
            children: (
              <Card extra={exam.status === 'draft' && (
                <Space>
                  <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>导入题目</Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingQuestion(null); qForm.resetFields(); setQuestionDrawer(true) }}>添加题目</Button>
                </Space>
              )}>
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
                      render: (_, r) => exam.status === 'draft' ? (
                        <Space>
                          <a onClick={() => { setEditingQuestion(r); qForm.setFieldsValue(r); setQuestionDrawer(true) }}>编辑</a>
                          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteQuestion(r.id)}><a style={{ color: '#ff4d4f' }}>删除</a></Popconfirm>
                        </Space>
                      ) : <Typography.Text type="secondary">已锁定</Typography.Text>,
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
              <Card extra={<Space>{exam.status === 'open' && <Button onClick={handleCreateTestSubmission}>生成测试答卷</Button>}{exam.status === 'grading' && <Button type="primary" onClick={handlePublish}>公布成绩</Button>}</Space>}>
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

      <Modal
        title="导入模考题目"
        open={importOpen}
        onCancel={closeImportModal}
        width={1000}
        destroyOnClose
        footer={[
          <Button key="cancel" onClick={closeImportModal}>取消</Button>,
          <Button key="preview" loading={previewingImport} onClick={handlePreviewImport}>解析预览</Button>,
          <Button key="import" type="primary" loading={importingQuestions} disabled={!importPreview?.items.length} onClick={handleImportPreviewItems}>
            确认导入为草稿
          </Button>,
        ]}
      >
        <Alert
          showIcon
          type="info"
          message="导入不会直接开放考试"
          description="老师上传 Word（.docx）文档后，系统先识别题干、选项、答案、解析和分值；确认导入后仍是草稿题，必须在题目列表复核质量和答案后再开放考试。推荐格式：1. 题干 / A. 选项 / B. 选项 / 答案：A / 解析：... / 分值：2 / 题型：单选题。"
          style={{ marginBottom: 16 }}
        />
        <Upload.Dragger
          accept=".docx"
          maxCount={1}
          beforeUpload={(file) => {
            setImportFile(file as File)
            setImportPreview(undefined)
            return false
          }}
          onRemove={() => {
            setImportFile(undefined)
            setImportPreview(undefined)
          }}
        >
          <p className="ant-upload-drag-icon"><UploadOutlined /></p>
          <p className="ant-upload-text">选择模考题目 Word 文档</p>
          <p className="ant-upload-hint">支持单选、多选、判断、简答和案例分析；主观题可不写选项。</p>
        </Upload.Dragger>

        {importPreview && (
          <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 16 }}>
            <Space>
              <Tag color="blue">识别 {importPreview.summary.total} 道</Tag>
              <Tag color="green">可直接复核 {importPreview.summary.ready} 道</Tag>
              <Tag color="orange">需重点复核 {importPreview.summary.needsReview} 道</Tag>
            </Space>
            <Table
              rowKey={(_, index) => String(index)}
              size="small"
              pagination={{ pageSize: 10 }}
              dataSource={importPreview.items}
              columns={[
                { title: '序号', dataIndex: 'seq', width: 60 },
                { title: '题型', dataIndex: 'type', width: 90, render: (v) => questionTypeOptions.find((o) => o.value === v)?.label || v },
                { title: '题干', dataIndex: 'stem', width: 260, ellipsis: true },
                { title: '选项', dataIndex: 'optionsJson', width: 220, render: (v) => <Typography.Text style={{ whiteSpace: 'pre-line' }}>{formatOptionsJson(v)}</Typography.Text> },
                { title: '答案', dataIndex: 'answer', width: 80 },
                { title: '分值', dataIndex: 'score', width: 70 },
                { title: '问题', dataIndex: 'issues', width: 180, render: (issues: string[]) => issues?.length ? issues.map((issue) => <Tag key={issue} color="orange">{issue}</Tag>) : <Tag color="green">通过</Tag> },
              ]}
            />
          </Space>
        )}
      </Modal>

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
                  <Form.Item name={`score_${a.questionId}`} label="给分" rules={[{ required: true, message: '请填写分数' }]} style={{ marginTop: 8, marginBottom: 0 }}>
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
