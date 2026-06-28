import { DeleteOutlined, EditOutlined, InboxOutlined, PlusOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import { Button, Card, Col, Collapse, Descriptions, Drawer, Form, Input, InputNumber, message, Modal, Popconfirm, Row, Select, Space, Spin, Table, Tabs, Tag, Typography, Upload } from 'antd'
import type { UploadFile } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import {
  batchGenerateStudyCardTokens,
  commitStudyCardImport,
  createAdminKnowledgeCard,
  createAdminStudyCardModule,
  createAdminStudyCardQuestion,
  deleteAdminKnowledgeCard,
  deleteAdminStudyCardModule,
  deleteAdminStudyCardQuestion,
  disableStudyCardToken,
  extendStudyCardToken,
  previewStudyCardImport,
  queryAdminModuleQuestions,
  queryAdminStudyCardModules,
  queryStudyCardTokens,
  updateAdminKnowledgeCard,
  updateAdminStudyCardModule,
  updateAdminStudyCardQuestion,
  type AdminStudyCardModule,
  type AdminStudyCardQuestion,
  type StudyCardToken,
} from '@/services/adminNursing'
import RichTextEditor, { type RichTextSegment } from './RichTextEditor'

const { Title, Text } = Typography
const { Dragger } = Upload

interface ParsedQuestion {
  seq: number
  stem: string
  type: string
  options: { key: string; text: string }[]
  answer: string
  knowledgeCards: { seq: number; title: string; body: unknown[] }[]
}

interface ParsedModule {
  moduleCode: string
  moduleName: string
  sort: number
  questions: ParsedQuestion[]
}

interface PreviewData {
  modules: ParsedModule[]
  totalQuestions: number
  totalCards: number
}

function ImportTab() {
  const [modules, setModules] = useState<AdminStudyCardModule[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])

  async function loadModules() {
    setLoading(true)
    try { setModules(await queryAdminStudyCardModules()) } catch { message.error('加载失败') } finally { setLoading(false) }
  }
  useEffect(() => { loadModules() }, [])

  async function handleDelete(moduleCode: string) {
    try { await deleteAdminStudyCardModule(moduleCode); message.success('已删除'); loadModules() } catch { message.error('删除失败') }
  }

  async function handleUpload(file: File) {
    setUploading(true)
    try { const data = await previewStudyCardImport(file); setPreviewData(data as PreviewData); setPreviewOpen(true) }
    catch (e: unknown) { message.error(e instanceof Error ? e.message : '解析失败') }
    finally { setUploading(false) }
    return false
  }

  async function handleImport() {
    if (!previewData) return
    setImporting(true)
    try {
      const result = await commitStudyCardImport(previewData)
      message.success(`导入成功：${result.modules.length} 个模块`)
      setPreviewOpen(false); setPreviewData(null); setFileList([]); loadModules()
    } catch (e: unknown) { message.error(e instanceof Error ? e.message : '导入失败') }
    finally { setImporting(false) }
  }

  const columns = [
    { title: '模块代码', dataIndex: 'moduleCode', width: 140 },
    { title: '模块名称', dataIndex: 'moduleName' },
    { title: '题目数', dataIndex: 'questionCount', width: 80 },
    { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <Tag color={v === 'published' ? 'green' : 'default'}>{v === 'published' ? '已发布' : v}</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '操作', width: 80, render: (_: unknown, record: AdminStudyCardModule) => (
      <Popconfirm title="确认删除该模块及所有题目？" onConfirm={() => handleDelete(record.moduleCode)}>
        <Button type="text" danger icon={<DeleteOutlined />} size="small" />
      </Popconfirm>
    )},
  ]

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Card title="带背模块列表" extra={<Button icon={<ReloadOutlined />} onClick={loadModules} loading={loading}>刷新</Button>}>
          <Table rowKey="id" dataSource={modules} columns={columns} loading={loading} pagination={false} size="small" />
        </Card>
      </Col>
      <Col span={24}>
        <Card title="上传带背文档">
          <Spin spinning={uploading} tip="解析中...">
            <Dragger accept=".docx" fileList={fileList} beforeUpload={(file) => { setFileList([file as unknown as UploadFile]); handleUpload(file); return false }} onRemove={() => setFileList([])} maxCount={1}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽 .docx 文件到此区域</p>
              <p className="ant-upload-hint">上传后自动解析预览，确认后导入数据库</p>
            </Dragger>
          </Spin>
        </Card>
      </Col>
      <Modal title="导入预览" open={previewOpen} width={800} onCancel={() => setPreviewOpen(false)} footer={<Space><Button onClick={() => setPreviewOpen(false)}>取消</Button><Button type="primary" loading={importing} onClick={handleImport}>确认导入</Button></Space>}>
        {previewData && (
          <>
            <Descriptions size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="模块数">{previewData.modules.length}</Descriptions.Item>
              <Descriptions.Item label="题目数">{previewData.totalQuestions}</Descriptions.Item>
              <Descriptions.Item label="知识点卡片数">{previewData.totalCards}</Descriptions.Item>
            </Descriptions>
            <Collapse size="small" items={previewData.modules.map((mod) => ({
              key: mod.moduleCode,
              label: `${mod.moduleName}（${mod.questions.length} 题）`,
              children: mod.questions.map((q) => (
                <div key={q.seq} style={{ marginBottom: 12, padding: '8px 12px', background: '#f9f9f9', borderRadius: 6 }}>
                  <Text strong>{q.seq}. {q.stem}</Text>
                  <div style={{ marginTop: 4 }}>{q.options.map((opt) => <Text key={opt.key} style={{ marginRight: 12, color: opt.key === q.answer ? '#13a8a8' : undefined }}>{opt.key}. {opt.text}</Text>)}</div>
                  <div style={{ marginTop: 4 }}><Tag color="green">答案: {q.answer}</Tag><Tag>{q.knowledgeCards.length} 张知识点卡片</Tag></div>
                </div>
              )),
            }))} />
          </>
        )}
      </Modal>
    </Row>
  )
}

function ManageTab() {
  const [modules, setModules] = useState<AdminStudyCardModule[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedModule, setSelectedModule] = useState<string | null>(null)
  const [questions, setQuestions] = useState<AdminStudyCardQuestion[]>([])
  const [qLoading, setQLoading] = useState(false)

  const [moduleModalOpen, setModuleModalOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<AdminStudyCardModule | null>(null)
  const [moduleForm] = Form.useForm()

  const [questionDrawerOpen, setQuestionDrawerOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<AdminStudyCardQuestion | null>(null)
  const [questionForm] = Form.useForm()

  const [cardDrawerOpen, setCardDrawerOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<{ id?: string; questionId: string; title: string; body: RichTextSegment[] } | null>(null)
  const [cardBody, setCardBody] = useState<RichTextSegment[]>([])

  const loadModules = useCallback(async () => {
    setLoading(true)
    try { setModules(await queryAdminStudyCardModules()) } catch { message.error('加载失败') } finally { setLoading(false) }
  }, [])

  const loadQuestions = useCallback(async (code: string) => {
    setQLoading(true)
    try { setQuestions(await queryAdminModuleQuestions(code)) } catch { message.error('加载题目失败') } finally { setQLoading(false) }
  }, [])

  useEffect(() => { loadModules() }, [loadModules])
  useEffect(() => { if (selectedModule) loadQuestions(selectedModule) }, [selectedModule, loadQuestions])

  function openModuleModal(mod?: AdminStudyCardModule) {
    setEditingModule(mod || null)
    moduleForm.resetFields()
    if (mod) moduleForm.setFieldsValue({ moduleCode: mod.moduleCode, moduleName: mod.moduleName, sort: mod.sort, status: mod.status })
    setModuleModalOpen(true)
  }

  async function handleModuleSubmit() {
    const values = await moduleForm.validateFields()
    try {
      if (editingModule) {
        await updateAdminStudyCardModule(editingModule.moduleCode, { moduleName: values.moduleName, sort: values.sort, status: values.status })
      } else {
        await createAdminStudyCardModule(values)
      }
      message.success(editingModule ? '已更新' : '已创建')
      setModuleModalOpen(false)
      loadModules()
    } catch (e: unknown) { message.error(e instanceof Error ? e.message : '操作失败') }
  }

  function openQuestionDrawer(q?: AdminStudyCardQuestion) {
    setEditingQuestion(q || null)
    questionForm.resetFields()
    if (q) {
      questionForm.setFieldsValue({ seq: q.seq, stem: q.stem, type: q.type, answer: q.answer, options: q.options })
    } else {
      questionForm.setFieldsValue({ type: 'single_choice', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }] })
    }
    setQuestionDrawerOpen(true)
  }

  async function handleQuestionSubmit() {
    const values = await questionForm.validateFields()
    if (!selectedModule && !editingQuestion) return
    try {
      if (editingQuestion) {
        await updateAdminStudyCardQuestion(editingQuestion.id, values)
      } else {
        await createAdminStudyCardQuestion(selectedModule!, values)
      }
      message.success(editingQuestion ? '已更新' : '已创建')
      setQuestionDrawerOpen(false)
      if (selectedModule) loadQuestions(selectedModule)
    } catch (e: unknown) { message.error(e instanceof Error ? e.message : '操作失败') }
  }

  async function handleDeleteQuestion(id: string) {
    try { await deleteAdminStudyCardQuestion(id); message.success('已删除'); if (selectedModule) loadQuestions(selectedModule) }
    catch { message.error('删除失败') }
  }

  function openCardDrawer(questionId: string, card?: { id: string; seq: number; title: string; body: unknown[] }) {
    if (card) {
      setEditingCard({ id: card.id, questionId, title: card.title, body: card.body as RichTextSegment[] })
      setCardBody(card.body as RichTextSegment[])
    } else {
      setEditingCard({ questionId, title: '带背知识点', body: [] })
      setCardBody([])
    }
    setCardDrawerOpen(true)
  }

  async function handleCardSubmit() {
    if (!editingCard) return
    try {
      if (editingCard.id) {
        await updateAdminKnowledgeCard(editingCard.id, { title: editingCard.title, body: cardBody })
      } else {
        await createAdminKnowledgeCard(editingCard.questionId, { title: editingCard.title, body: cardBody })
      }
      message.success('已保存')
      setCardDrawerOpen(false)
      if (selectedModule) loadQuestions(selectedModule)
    } catch (e: unknown) { message.error(e instanceof Error ? e.message : '操作失败') }
  }

  async function handleDeleteCard(id: string) {
    try { await deleteAdminKnowledgeCard(id); message.success('已删除'); if (selectedModule) loadQuestions(selectedModule) }
    catch { message.error('删除失败') }
  }

  const questionColumns = [
    { title: '序号', dataIndex: 'seq', width: 60 },
    { title: '题干', dataIndex: 'stem', ellipsis: true, render: (v: string) => v.slice(0, 40) },
    { title: '类型', dataIndex: 'type', width: 80, render: (v: string) => v === 'single_choice' ? '单选' : '判断' },
    { title: '答案', dataIndex: 'answer', width: 60 },
    { title: '卡片数', width: 70, render: (_: unknown, r: AdminStudyCardQuestion) => r.knowledgeCards.length },
    { title: '操作', width: 160, render: (_: unknown, r: AdminStudyCardQuestion) => (
      <Space size={4}>
        <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openQuestionDrawer(r)}>编辑</Button>
        <Button size="small" type="link" onClick={() => openCardDrawer(r.id)}>+卡片</Button>
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteQuestion(r.id)}>
          <Button size="small" type="link" danger>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ]

  return (
    <Row gutter={16}>
      <Col span={6}>
        <Card size="small" title="模块" extra={<Button size="small" icon={<PlusOutlined />} onClick={() => openModuleModal()}>新建</Button>}>
          <Spin spinning={loading}>
            {modules.map((m) => (
              <div key={m.moduleCode} onClick={() => setSelectedModule(m.moduleCode)} style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 6, marginBottom: 4, background: selectedModule === m.moduleCode ? '#e6f4ff' : undefined }}>
                <div style={{ fontWeight: 500 }}>{m.moduleName}</div>
                <div style={{ fontSize: 12, color: '#999' }}>{m.moduleCode} · {m.questionCount}题</div>
                <Button size="small" type="link" onClick={(e) => { e.stopPropagation(); openModuleModal(m) }}>编辑</Button>
              </div>
            ))}
          </Spin>
        </Card>
      </Col>
      <Col span={18}>
        {selectedModule ? (
          <Card size="small" title={`题目列表 — ${modules.find((m) => m.moduleCode === selectedModule)?.moduleName || ''}`} extra={<Button icon={<PlusOutlined />} size="small" onClick={() => openQuestionDrawer()}>新增题目</Button>}>
            <Table rowKey="id" dataSource={questions} columns={questionColumns} loading={qLoading} pagination={false} size="small"
              expandable={{ expandedRowRender: (record: AdminStudyCardQuestion) => (
                <div style={{ paddingLeft: 24 }}>
                  {record.knowledgeCards.map((card) => (
                    <div key={card.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Tag>{card.title}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>{(card.body as RichTextSegment[]).map((s) => s.text).join('').slice(0, 50)}...</Text>
                      <Button size="small" type="link" onClick={() => openCardDrawer(record.id, card)}>编辑</Button>
                      <Popconfirm title="删除此卡片？" onConfirm={() => handleDeleteCard(card.id)}><Button size="small" type="link" danger>删除</Button></Popconfirm>
                    </div>
                  ))}
                </div>
              )}}
            />
          </Card>
        ) : (
          <Card size="small"><Text type="secondary">← 选择一个模块查看题目</Text></Card>
        )}
      </Col>

      {/* Module Modal */}
      <Modal title={editingModule ? '编辑模块' : '新建模块'} open={moduleModalOpen} onCancel={() => setModuleModalOpen(false)} onOk={handleModuleSubmit} destroyOnClose>
        <Form form={moduleForm} layout="vertical">
          <Form.Item name="moduleCode" label="模块代码" rules={[{ required: true }]}>
            <Input disabled={!!editingModule} placeholder="如 intro, locomotor" />
          </Form.Item>
          <Form.Item name="moduleName" label="模块名称" rules={[{ required: true }]}>
            <Input placeholder="如 绪论带背" />
          </Form.Item>
          <Form.Item name="sort" label="排序">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="published">
            <Select options={[{ value: 'published', label: '已发布' }, { value: 'draft', label: '草稿' }, { value: 'offline', label: '下线' }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Question Drawer */}
      <Drawer title={editingQuestion ? '编辑题目' : '新增题目'} open={questionDrawerOpen} onClose={() => setQuestionDrawerOpen(false)} width={600} extra={<Button type="primary" onClick={handleQuestionSubmit}>保存</Button>} destroyOnClose>
        <Form form={questionForm} layout="vertical">
          <Form.Item name="seq" label="序号">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="stem" label="题干" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="type" label="题型">
            <Select options={[{ value: 'single_choice', label: '单选题' }, { value: 'judgment', label: '判断题' }]} />
          </Form.Item>
          <Form.List name="options">
            {(fields) => (
              <div>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>选项</div>
                {fields.map((field) => (
                  <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item name={[field.name, 'key']} noStyle><Input style={{ width: 40 }} disabled /></Form.Item>
                    <Form.Item name={[field.name, 'text']} noStyle rules={[{ required: true }]}><Input style={{ width: 400 }} placeholder="选项内容" /></Form.Item>
                  </Space>
                ))}
              </div>
            )}
          </Form.List>
          <Form.Item name="answer" label="正确答案" rules={[{ required: true }]}>
            <Select options={['A', 'B', 'C', 'D'].map((k) => ({ value: k, label: k }))} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Knowledge Card Drawer */}
      <Drawer title={editingCard?.id ? '编辑知识卡片' : '新增知识卡片'} open={cardDrawerOpen} onClose={() => setCardDrawerOpen(false)} width={700} extra={<Button type="primary" onClick={handleCardSubmit}>保存</Button>} destroyOnClose>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>卡片标题</div>
          <Select value={editingCard?.title} onChange={(v) => setEditingCard((prev) => prev ? { ...prev, title: v } : null)} style={{ width: '100%' }}
            options={[{ value: '带背知识点', label: '带背知识点' }, { value: '题目点评', label: '题目点评' }, { value: '带背知识点延伸', label: '带背知识点延伸' }]}
          />
        </div>
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>内容（支持颜色标记和加粗）</div>
          <RichTextEditor value={cardBody} onChange={setCardBody} />
        </div>
      </Drawer>
    </Row>
  )
}

function LicenseTab() {
  const [tokens, setTokens] = useState<StudyCardToken[]>([])
  const [loading, setLoading] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [genForm] = Form.useForm()
  const [generating, setGenerating] = useState(false)
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([])

  const loadTokens = useCallback(async () => {
    setLoading(true)
    try { setTokens(await queryStudyCardTokens()) } catch { message.error('加载失败') } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadTokens() }, [loadTokens])

  async function handleGenerate() {
    const values = await genForm.validateFields()
    setGenerating(true)
    try {
      const result = await batchGenerateStudyCardTokens(values)
      setGeneratedCodes(result.map((t) => t.code))
      message.success(`已生成 ${result.length} 个授权码`)
      loadTokens()
    } catch (e: unknown) { message.error(e instanceof Error ? e.message : '生成失败') }
    finally { setGenerating(false) }
  }

  async function handleDisable(id: string) {
    try { await disableStudyCardToken(id); message.success('已禁用'); loadTokens() } catch { message.error('操作失败') }
  }

  async function handleExtend(id: string) {
    Modal.confirm({
      title: '延期授权码',
      content: '延期 30 天？',
      onOk: async () => {
        try { await extendStudyCardToken(id, 30); message.success('已延期 30 天'); loadTokens() } catch { message.error('操作失败') }
      },
    })
  }

  const columns = [
    { title: '授权码', dataIndex: 'code', width: 140 },
    { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <Tag color={v === 'unused' ? 'blue' : v === 'bound' ? 'green' : 'default'}>{v === 'unused' ? '未使用' : v === 'bound' ? '已绑定' : '已禁用'}</Tag> },
    { title: '绑定用户', dataIndex: 'boundOpenId', width: 120, render: (v: string | null) => v ? <Text copyable style={{ fontSize: 12 }}>{v.slice(0, 10)}...</Text> : '-' },
    { title: '过期时间', dataIndex: 'expiresAt', width: 160, render: (v: string | null) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '分组', dataIndex: 'groupTag', width: 100, render: (v: string | null) => v || '-' },
    { title: '操作', width: 140, render: (_: unknown, r: StudyCardToken) => (
      <Space size={4}>
        {r.status !== 'disabled' && <Button size="small" type="link" danger icon={<StopOutlined />} onClick={() => handleDisable(r.id)}>禁用</Button>}
        {r.status === 'bound' && <Button size="small" type="link" onClick={() => handleExtend(r.id)}>延期</Button>}
      </Space>
    )},
  ]

  return (
    <Card title="带背授权码" extra={<Space><Button onClick={loadTokens} loading={loading}>刷新</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => { setGenOpen(true); setGeneratedCodes([]); genForm.resetFields() }}>批量生成</Button></Space>}>
      <Table rowKey="id" dataSource={tokens} columns={columns} loading={loading} pagination={{ pageSize: 20 }} size="small" />
      <Modal title="批量生成带背授权码" open={genOpen} onCancel={() => setGenOpen(false)} onOk={handleGenerate} confirmLoading={generating} destroyOnClose>
        <Form form={genForm} layout="vertical" initialValues={{ count: 10, expiresDays: 30 }}>
          <Form.Item name="count" label="数量" rules={[{ required: true }]}><InputNumber min={1} max={100} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="expiresDays" label="有效天数（最低1天）" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="groupTag" label="分组标签"><Input placeholder="可选，用于分组管理" /></Form.Item>
        </Form>
        {generatedCodes.length > 0 && (
          <div style={{ marginTop: 12, padding: 12, background: '#f6ffed', borderRadius: 6 }}>
            <Text strong>已生成 {generatedCodes.length} 个授权码：</Text>
            <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 13 }}>{generatedCodes.join('\n')}</div>
          </div>
        )}
      </Modal>
    </Card>
  )
}

export default function StudyCardsPage() {
  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>题目带背管理</Title>
      <Tabs defaultActiveKey="manage" items={[
        { key: 'manage', label: '手动管理', children: <ManageTab /> },
        { key: 'license', label: '授权码管理', children: <LicenseTab /> },
        { key: 'import', label: '文档导入', children: <ImportTab /> },
      ]} />
    </div>
  )
}
