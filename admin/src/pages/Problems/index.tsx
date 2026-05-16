import { CheckCircleOutlined, CopyOutlined, RocketOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Col, Divider, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Tag, Typography, message } from 'antd'
import { useMemo, useRef, useState } from 'react'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { ProTable } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { PublishStatusTag } from '@/components/status'
import { difficultyOptions, nursingModuleNameMap, nursingModuleOptions, problemTypeOptions, statusOptions } from '@/constants/options'
import { appendAdminOperationLog } from '@/services/adminOperationLog'
import { adminFetch } from '@/services/adminApi'
import { queryConfusingPoints, queryMemoryTips } from '@/services/content'
import { deleteNursingEntity, saveNursingEntity, updateNursingEntityStatus } from '@/services/nursingContent'
import { getCurrentSubjectCode } from '@/services/subjects'
import type { ConfusingPoint, MemoryTip, Problem } from '@/types/content'

type ProblemRow = Problem & {
  onEdit?: () => void
  onPublish?: () => void
  onDelete?: () => void
}

const moduleChapterPresets: Record<string, string[]> = {
  anatomy: ['绪论', '运动系统', '消化系统', '呼吸系统', '泌尿系统', '男性生殖系统', '女性生殖系统', '腹膜', '脉管系统', '感觉器', '神经系统', '内分泌系统'],
  physiology: ['细胞生理', '血液', '循环系统', '呼吸系统', '消化与吸收', '泌尿系统', '感觉器官', '神经系统', '内分泌', '生殖'],
  clinical_medicine: ['症状学', '实验室与辅助检查', '呼吸系统疾病', '循环系统疾病', '消化系统疾病', '泌尿系统疾病', '血液系统疾病', '内分泌和代谢', '风湿免疫', '脑血管疾病', '传染病'],
  clinical_skills: ['技能一', '技能二', '技能三', '技能四', '技能五', '技能六'],
}

const subjectCode = getCurrentSubjectCode()
const isNursing = subjectCode === 'nursing'
const confusingMap = new Map<string, string[]>()
const memoryTipMap = new Map<string, string[]>()
queryConfusingPoints().then((result) => {
  result.data.forEach((item: ConfusingPoint) => {
    ;[item.leftConcept, item.rightConcept].forEach((tag) => {
      const current = confusingMap.get(tag) ?? []
      confusingMap.set(tag, [...current, item.title])
    })
  })
})
queryMemoryTips().then((result) => {
  result.data.forEach((item: MemoryTip) => {
    item.relatedKnowledgeTags.forEach((tag) => {
      const current = memoryTipMap.get(tag) ?? []
      memoryTipMap.set(tag, [...current, item.title])
    })
  })
})

async function syncProblemToBackend(problem: Problem) {
  return adminFetch<Problem>('/admin/questions', {
    method: 'POST',
    body: JSON.stringify({
      id: problem.id,
      title: problem.title,
      stem: problem.stem || problem.title,
      type: problem.type,
      difficulty: problem.difficulty,
      moduleCode: problem.moduleCode,
      moduleName: problem.moduleName,
      chapter: problem.chapter,
      chapterSort: problem.chapterSort,
      knowledgeTags: problem.knowledgeTags,
      optionsJson: problem.optionsJson,
      answer: problem.answer,
      analysis: problem.analysis,
      source: problem.source,
      status: problem.status,
    }),
  })
}

async function offlineProblemInBackend(id: string) {
  return adminFetch<Problem>(`/admin/questions/${id}`, { method: 'DELETE' })
}

function normalizeProblem(item: any): Problem {
  return {
    subjectCode: 'nursing',
    id: item.id,
    title: item.title,
    stem: item.stem || item.title,
    type: item.type === 'short_answer' ? 'solution' : item.type,
    difficulty: item.difficulty,
    moduleCode: item.moduleCode,
    moduleName: item.moduleName,
    chapter: item.chapter,
    chapterSort: item.chapterSort,
    knowledgeTags: typeof item.knowledgeTags === 'string' ? item.knowledgeTags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : item.knowledgeTags || [],
    optionsJson: item.optionsJson,
    answer: item.answer,
    analysis: item.analysis,
    source: item.source,
    status: item.status,
    updatedAt: String(item.updatedAt || '').slice(0, 10),
  }
}

function copyText(value?: string, label = '内容') {
  if (!value) {
    message.warning(`暂无可复制${label}`)
    return
  }
  navigator.clipboard?.writeText(value)
  message.success(`${label}已复制`)
}

function parseKnowledgeTags(value: unknown) {
  return String(value || '').split(/[，,]/).map((item) => item.trim()).filter(Boolean)
}

function hasPlaceholderValue(value: unknown) {
  return ['待补充', '待补充小章节', '未命名题目'].includes(String(value || '').trim())
}

function getProblemPublishIssues(problem: Partial<Problem>) {
  const issues: string[] = []
  const knowledgeTags = Array.isArray(problem.knowledgeTags) ? problem.knowledgeTags : parseKnowledgeTags(problem.knowledgeTags)

  if (!String(problem.title || '').trim() || hasPlaceholderValue(problem.title)) issues.push('题目标题')
  if (!String(problem.stem || problem.title || '').trim() || hasPlaceholderValue(problem.stem || problem.title)) issues.push('题干')
  if (!String(problem.moduleCode || '').trim()) issues.push('一级板块')
  if (!String(problem.chapter || '').trim() || hasPlaceholderValue(problem.chapter)) issues.push('小章节')
  if (knowledgeTags.length < 1) issues.push('至少 1 个知识点')
  if (!String(problem.answer || '').trim() || hasPlaceholderValue(problem.answer)) issues.push('答案')
  if (!String(problem.analysis || '').trim() || hasPlaceholderValue(problem.analysis)) issues.push('解析')

  if (problem.type === 'single_choice' || problem.type === 'multiple_choice') {
    try {
      const options = JSON.parse(String(problem.optionsJson || ''))
      const completeOptions = Array.isArray(options)
        ? options.filter((option) => String(option?.key || '').trim() && String(option?.content || '').trim())
        : []
      if (completeOptions.length < 2) issues.push('选择题至少需要 2 个完整选项')
    } catch {
      issues.push('选择题选项 JSON 必须是合法 JSON 数组')
    }
  }

  return issues
}

function warnProblemPublishIssues(issues: string[]) {
  Modal.warning({
    title: '题目发布前校验未通过',
    content: (
      <Space direction="vertical" size={4}>
        <Typography.Text>请先补齐以下内容后再发布：</Typography.Text>
        {issues.map((issue) => <Typography.Text key={issue}>• {issue}</Typography.Text>)}
      </Space>
    ),
  })
}

export default function ProblemsPage() {
  const actionRef = useRef<ActionType>()
  const [activeModuleCode, setActiveModuleCode] = useState<string>('all')
  const [form] = Form.useForm<Problem>()
  const selectedModuleCode = Form.useWatch('moduleCode', form)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Problem>()
  const [selectedRows, setSelectedRows] = useState<ProblemRow[]>([])

  function reload() { actionRef.current?.reload() }
  function openCreate() {
    setEditing(undefined)
    form.setFieldsValue({ title: '', stem: '', type: 'single_choice' as any, difficulty: 'basic' as any, moduleCode: 'anatomy', moduleName: '人体解剖学', chapter: '待补充小章节', chapterSort: 1, knowledgeTags: [] as any, optionsJson: '[{"key":"A","content":""},{"key":"B","content":""}]', answer: '', analysis: '', source: '', status: 'draft' as any })
    setOpen(true)
  }
  function openEdit(record: Problem) {
    setEditing(record)
    form.setFieldsValue({ ...record, knowledgeTags: record.knowledgeTags.join('，') as any })
    setOpen(true)
  }
  async function submit() {
    const values = form.getFieldsValue(true)
    const knowledgeTags = parseKnowledgeTags(values.knowledgeTags)
    const payload = {
      title: values.title,
      stem: values.stem || values.title,
      type: values.type || 'single_choice',
      difficulty: values.difficulty || 'basic',
      moduleCode: values.moduleCode || 'anatomy',
      moduleName: nursingModuleNameMap[String(values.moduleCode || 'anatomy')] || '人体解剖学',
      chapter: values.chapter || '待补充小章节',
      chapterSort: values.chapterSort || 1,
      knowledgeTags,
      optionsJson: values.optionsJson || '[]',
      answer: values.answer || '',
      analysis: values.analysis || '',
      source: values.source || '',
      status: values.status || 'draft',
    }

    if (payload.status === 'published') {
      const issues = getProblemPublishIssues(payload as Partial<Problem>)
      if (issues.length > 0) {
        warnProblemPublishIssues(issues)
        return
      }
    }

    const saved = saveNursingEntity('problems', payload, editing?.id)
    try {
      await syncProblemToBackend(saved)
      if (saved.status === 'published' && editing?.status !== 'published') {
        appendAdminOperationLog({ type: 'problem_publish', targetId: saved.id, targetTitle: saved.title })
      }
      message.success(`${editing ? '题目已更新并同步到小程序题库' : '题目已新增并同步到小程序题库'}${saved.status === 'published' ? '，已记录操作日志' : ''}`)
      setOpen(false)
      reload()
    } catch (error) {
      console.warn('sync problem to backend failed', error)
      message.error('题目已保存到后台本地，但同步到小程序题库失败，请检查后端服务')
    }
  }

  const wrapRows = (data: Problem[]): ProblemRow[] => data
    .filter((record) => activeModuleCode === 'all' || record.moduleCode === activeModuleCode)
    .map((record) => ({
    ...record,
    onEdit: () => openEdit(record),
    onPublish: async () => {
      const nextStatus: Problem['status'] = record.status === 'published' ? 'offline' : 'published'
      const nextRecord: Problem = { ...record, status: nextStatus, updatedAt: new Date().toISOString().slice(0, 10) }
      if (nextStatus === 'published') {
        const issues = getProblemPublishIssues(record)
        if (issues.length > 0) {
          warnProblemPublishIssues(issues)
          return
        }
      }
      try {
        await syncProblemToBackend(nextRecord)
        updateNursingEntityStatus('problems', record.id, nextStatus)
        appendAdminOperationLog({ type: nextStatus === 'published' ? 'problem_publish' : 'problem_offline', targetId: record.id, targetTitle: record.title })
        message.success(`题目已${nextStatus === 'published' ? '发布' : '下线'}并同步到小程序题库，已记录操作日志`)
        reload()
      } catch (error) {
        console.warn('sync problem status to backend failed', error)
        message.error('题目状态同步失败，请检查后端服务')
      }
    },
    onDelete: async () => {
      try {
        await offlineProblemInBackend(record.id)
        deleteNursingEntity('problems', record.id)
        appendAdminOperationLog({ type: 'problem_delete', targetId: record.id, targetTitle: record.title })
        message.success('题目已删除，并已从小程序题库下线，已记录操作日志')
        reload()
      } catch (error) {
        console.warn('delete problem from backend failed', error)
        message.error('题目删除同步失败，请检查后端服务')
      }
    },
  }))

  const request = async () => {
    try {
      const backendData = await adminFetch<unknown[]>('/admin/questions')
      const data: Problem[] = Array.isArray(backendData) ? backendData.map(normalizeProblem) : []
      return { data: wrapRows(data), success: true }
    } catch (error) {
      console.warn('query backend questions failed', error)
      message.error('题目列表加载失败，请确认后端服务是否可用')
      return { data: [], success: true }
    }
  }

  async function handleBatchPublish() {
    if (selectedRows.length === 0) {
      message.warning('请先选择要发布的草稿题')
      return
    }

    const draftRows = selectedRows.filter((r) => r.status === 'draft')
    if (draftRows.length === 0) {
      message.warning('所选题目中没有草稿状态的题目')
      return
    }

    try {
      const result = await adminFetch<{ published: number }>('/admin/questions/batch-publish', {
        method: 'POST',
        body: JSON.stringify({ ids: draftRows.map((r) => r.id) }),
      })
      message.success(`已发布 ${result?.published ?? draftRows.length} 道草稿题`)
      setSelectedRows([])
      reload()
    } catch (error) {
      console.warn('batch publish problems failed', error)
      message.error('批量发布失败，请检查后端服务')
    }
  }

  async function handleBatchPublishAll() {
    const filterPayload: { status?: string; moduleCode?: string } = {}
    if (activeModuleCode !== 'all') filterPayload.moduleCode = activeModuleCode

    Modal.confirm({
      title: '发布全部草稿题',
      content: `确认将${activeModuleCode === 'all' ? '所有模块' : nursingModuleNameMap[activeModuleCode] || activeModuleCode}的全部草稿题发布到小程序题库？`,
      okText: '确认发布',
      onOk: async () => {
        try {
          const result = await adminFetch<{ published: number }>('/admin/questions/batch-publish', {
            method: 'POST',
            body: JSON.stringify({ filter: filterPayload }),
          })
          message.success(`已发布 ${result?.published ?? 0} 道草稿题`)
          reload()
        } catch (error) {
          console.warn('batch publish all failed', error)
          message.error('批量发布失败，请检查后端服务')
        }
      },
    })
  }

  const columns: ProColumns<ProblemRow>[] = isNursing ? [
    {
      title: '题目标题',
      dataIndex: 'title',
      ellipsis: true,
      width: 300,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong ellipsis style={{ maxWidth: 280 }}>{record.title}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{record.source || '未填写来源'} · {record.chapter || '小章节待补'}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '一级板块',
      dataIndex: 'moduleCode',
      valueType: 'select',
      width: 140,
      fieldProps: { options: nursingModuleOptions },
      render: (_, record) => <Tag color="cyan">{nursingModuleNameMap[record.moduleCode || ''] || record.moduleName || '-'}</Tag>,
    },
    { title: '题型', dataIndex: 'type', valueType: 'select', width: 110, fieldProps: { options: problemTypeOptions } },
    { title: '难度', dataIndex: 'difficulty', valueType: 'select', width: 100, fieldProps: { options: difficultyOptions } },
    { title: '状态', dataIndex: 'status', valueType: 'select', width: 110, fieldProps: { options: statusOptions }, render: (_, record) => <PublishStatusTag status={record.status} /> },
    { title: '更新时间', dataIndex: 'updatedAt', search: false, width: 120 },
    {
      title: '知识点',
      dataIndex: 'knowledgeTags',
      search: false,
      hideInTable: true,
      render: (_, record) => <Space wrap>{record.knowledgeTags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space>,
    },
    {
      title: '辅助关联',
      dataIndex: 'knowledgeTags',
      search: false,
      hideInTable: true,
      render: (_, record) => {
        const confusingMatches = record.knowledgeTags.flatMap((tag) => confusingMap.get(tag) ?? [])
        const memoryMatches = record.knowledgeTags.flatMap((tag) => memoryTipMap.get(tag) ?? [])
        return (
          <Space wrap>
            {confusingMatches.length > 0 ? <Tag color="orange">易混点 {new Set(confusingMatches).size}</Tag> : <Tag>易混点待补</Tag>}
            {memoryMatches.length > 0 ? <Tag color="purple">记忆提示 {new Set(memoryMatches).size}</Tag> : <Tag>记忆提示待补</Tag>}
          </Space>
        )
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      render: (_, record) => [
        <a key="edit" onClick={() => record.onEdit?.()}>编辑</a>,
        <a key="copy" onClick={() => copyText(record.id, '题目 ID')}><CopyOutlined /> ID</a>,
        <Popconfirm key="publish" title={record.status === 'published' ? '确认下线该题目？' : '确认发布该题目？'} description="发布后小程序题库可见；下线后将从小程序题库移除。" onConfirm={() => record.onPublish?.()} okText="确认" cancelText="取消">
          <a>{record.status === 'published' ? '下线' : '发布'}</a>
        </Popconfirm>,
        <Popconfirm key="delete" title="确认删除该题目？" description="删除后会从小程序题库下线，请谨慎操作。" onConfirm={() => record.onDelete?.()} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
          <a style={{ color: '#ff4d4f' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ] : []

  const moduleTags = useMemo(
    () => [{ label: '全部模块', value: 'all' }, ...nursingModuleOptions.map((item) => ({ label: item.label, value: String(item.value) }))],
    [],
  )

  return (
    <SubjectAwarePageContainer title="题目管理" content={isNursing ? '按四个一级医护板块维护题库，首屏保留核心字段与关键操作。' : '根据当前学科维护对应题库内容。'}>
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 12 }}
        message="老师高频操作流：新增题目 → 发布/下线 → 小程序题库可见"
        description="首屏只保留标题、一级板块、题型、难度、状态和更新时间；小章节、知识点、选项与答案放在展开详情。发布确认会提示小程序可见性，避免误操作。"
      />
      <Space wrap style={{ marginBottom: 10 }}>
        {moduleTags.map((tag) => (
          <Tag
            key={tag.value}
            color={activeModuleCode === tag.value ? 'cyan' : 'default'}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              setActiveModuleCode(tag.value)
              actionRef.current?.reload()
            }}
          >
            {tag.label}
          </Tag>
        ))}
      </Space>
      <ProTable<ProblemRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={request}
        search={{ labelWidth: 78, span: 6, defaultCollapsed: false }}
        options={{ density: true, fullScreen: true, reload: true }}
        size="small"
        scroll={{ x: 1080 }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        rowSelection={{
          selectedRowKeys: selectedRows.map((record) => record.id),
          onChange: (_, rows) => setSelectedRows(rows),
          getCheckboxProps: (record) => ({ disabled: record.status === 'published' }),
        }}
        expandable={{
          expandedRowRender: (record) => (
            <Card size="small" className="nursing-muted-card">
              <Row gutter={[16, 10]}>
                <Col xs={24} md={7}><Typography.Text type="secondary">小章节：</Typography.Text>{record.chapter || '-'}</Col>
                <Col xs={24} md={7}><Typography.Text type="secondary">知识点：</Typography.Text><Space wrap size={[4, 4]}>{record.knowledgeTags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space></Col>
                <Col xs={24} md={10}><Typography.Text type="secondary">答案：</Typography.Text><Typography.Text ellipsis={{ tooltip: record.answer }}>{record.answer || '-'}</Typography.Text></Col>
                <Col span={24}><Typography.Text type="secondary">题干：</Typography.Text><Typography.Text ellipsis={{ tooltip: record.stem || record.title }}>{record.stem || record.title || '-'}</Typography.Text></Col>
                <Col span={24}><Typography.Text type="secondary">解析：</Typography.Text><Typography.Text ellipsis={{ tooltip: record.analysis }}>{record.analysis || '-'}</Typography.Text></Col>
                <Col span={24}><Typography.Text type="secondary">选项 JSON：</Typography.Text><Typography.Text code copyable={{ text: record.optionsJson || '[]' }}>{record.optionsJson || '[]'}</Typography.Text></Col>
              </Row>
            </Card>
          ),
        }}
        toolBarRender={() => [
          <Tag key="visible-rule" icon={<CheckCircleOutlined />} color="green">仅已发布同步小程序可见</Tag>,
          <Button key="batch-publish" disabled={selectedRows.length === 0} onClick={handleBatchPublish}>批量发布所选</Button>,
          <Button key="batch-publish-all" onClick={handleBatchPublishAll}>发布全部草稿</Button>,
          <Button type="primary" key="create" icon={<RocketOutlined />} onClick={openCreate}>新增题目</Button>,
        ]}
      />
      <Drawer
        title={editing ? '编辑题目' : '新增题目'}
        open={open}
        width={760}
        onClose={() => setOpen(false)}
        destroyOnClose
        extra={<Space><Button onClick={() => setOpen(false)}>取消</Button><Button type="primary" onClick={submit}>保存并同步</Button></Space>}
      >
        <Alert showIcon type="success" style={{ marginBottom: 12 }} message="保存后立即尝试同步；若需学生端可见，请将状态设为已发布" description="建议先补齐标题、一级板块、知识点、答案/解析，再发布到小程序题库。" />
        <Form form={form} layout="vertical" preserve={false}>
          <Typography.Title level={5} className="nursing-section-title">基础信息</Typography.Title>
          <Row gutter={[12, 0]}>
            <Col span={24}><Form.Item name="title" label="题目标题" rules={[{ required: true, message: '请输入题目标题' }]}><Input placeholder="用于后台检索和小程序题目标题" /></Form.Item></Col>
            <Col span={24}><Form.Item name="stem" label="题干" tooltip="学生端展示的完整题干；为空时默认使用题目标题"><Input.TextArea rows={3} placeholder="请输入完整题干" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="type" label="题型"><Select options={problemTypeOptions} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="difficulty" label="难度"><Select options={difficultyOptions} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="source" label="来源"><Input placeholder="如：自建题库/公开资料整理" /></Form.Item></Col>
          </Row>
          <Divider style={{ margin: '10px 0 12px' }} />
          <Typography.Title level={5} className="nursing-section-title">四模块归属</Typography.Title>
          <Row gutter={[12, 0]}>
            <Col xs={24} md={12}><Form.Item name="moduleCode" label="一级板块" rules={[{ required: true, message: '请选择一级板块' }]}><Select options={nursingModuleOptions} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="chapter" label="小章节（与前端二级子章节一致）"><Input placeholder="例如：运动系统" /></Form.Item></Col>
            <Col xs={24} md={4}><Form.Item name="chapterSort" label="章节排序"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={24}>
              <Form.Item label="二级子模块快速选择（可继续手输）">
                <Space wrap>
                  {(moduleChapterPresets[String(selectedModuleCode || 'anatomy')] || []).map((chapter) => (
                    <Tag
                      key={chapter}
                      color={form.getFieldValue('chapter') === chapter ? 'cyan' : 'default'}
                      style={{ cursor: 'pointer' }}
                      onClick={() => form.setFieldValue('chapter', chapter)}
                    >
                      {chapter}
                    </Tag>
                  ))}
                </Space>
              </Form.Item>
            </Col>
          </Row>
          <Divider style={{ margin: '10px 0 12px' }} />
          <Typography.Title level={5} className="nursing-section-title">题目内容</Typography.Title>
          <Form.Item name="knowledgeTags" label="知识点标签" tooltip="多个标签用中文逗号或英文逗号分隔"><Input placeholder="生命体征，病情观察" /></Form.Item>
          <Form.Item
            name="optionsJson"
            label="选项 JSON"
            tooltip="选择题建议填写数组 JSON；填空题/解答题可保留 []。"
            rules={[{ validator: async (_, value) => { if (!value) return; try { JSON.parse(value); } catch { throw new Error('请输入合法 JSON，例如 [{"key":"A","content":"选项内容"}]') } } }]}
          >
            <Input.TextArea rows={4} placeholder='[{"key":"A","content":"选项内容"},{"key":"B","content":"选项内容"}]' />
          </Form.Item>
          <Form.Item name="answer" label="答案" rules={[{ required: true, message: '请输入答案' }]}><Input placeholder="例如：A 或 ABD" /></Form.Item>
          <Form.Item name="analysis" label="解析" tooltip="发布时需要补齐；导入题库会自动从答案解析文档带入"><Input.TextArea rows={4} placeholder="保持考试复习与学习辅助表述，不输出个体化诊疗建议" /></Form.Item>
          <Divider style={{ margin: '10px 0 12px' }} />
          <Typography.Title level={5} className="nursing-section-title">发布状态</Typography.Title>
          <Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item>
        </Form>
      </Drawer>
    </SubjectAwarePageContainer>
  )
}
