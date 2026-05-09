import { Button, Form, Input, Modal, Select, Space, Tag, message } from 'antd'
import { useEffect, useRef, useState } from 'react'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { ProTable } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { PublishStatusTag } from '@/components/status'
import { statusOptions } from '@/constants/options'
import { adminFetch } from '@/services/adminApi'
import type { DailyProblem, Problem } from '@/types/content'

type DailyProblemRow = DailyProblem

type ProblemOption = {
  label: string
  value: string
  tags: string[]
}

type BackendQuestionOption = {
  id: string
  title: string
  knowledgeTags?: string | string[]
  status?: Problem['status']
}

async function fetchProblemOptions(): Promise<ProblemOption[]> {
  try {
    const questions = await adminFetch<BackendQuestionOption[]>('/admin/questions')
    if (!Array.isArray(questions)) return []

    return questions
      .filter((item) => item.status === 'published')
      .map((item) => ({
        label: item.title,
        value: item.id,
        tags: typeof item.knowledgeTags === 'string' ? item.knowledgeTags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : [],
      }))
  } catch (error) {
    console.warn('fetch backend problem options failed', error)
    return []
  }
}

type BackendDailyPractice = {
  id: string
  subjectCode: 'nursing'
  date: string
  questionTitle: string
  knowledgeTags: string
  status: DailyProblem['status']
  updatedAt: string
}

async function queryBackendDailyProblems() {
  try {
    const rows = await adminFetch<BackendDailyPractice[]>('/admin/daily-practice')
    if (!Array.isArray(rows)) return { data: [], success: true }

    return {
      data: rows.map((item: BackendDailyPractice) => ({
        subjectCode: item.subjectCode,
        id: item.id,
        date: item.date.slice(0, 10),
        problemTitle: item.questionTitle,
        knowledgeTags: typeof item.knowledgeTags === 'string' ? item.knowledgeTags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
        status: item.status,
        updatedAt: item.updatedAt.slice(0, 10),
      })),
      success: true,
    }
  } catch (error) {
    console.warn('query backend daily practice failed', error)
    return { data: [], success: false }
  }
}

const columns: ProColumns<DailyProblemRow>[] = [
  { title: '日期', dataIndex: 'date', valueType: 'date' },
  { title: '题目/练习', dataIndex: 'problemTitle' },
  { title: '知识点', dataIndex: 'knowledgeTags', search: false, render: (_, record) => <Space>{record.knowledgeTags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space> },
  { title: '状态', dataIndex: 'status', valueType: 'select', fieldProps: { options: statusOptions }, render: (_, record) => <PublishStatusTag status={record.status} /> },
  { title: '更新时间', dataIndex: 'updatedAt', search: false },
]

export default function DailyProblemsPage() {
  const actionRef = useRef<ActionType>()
  const [form] = Form.useForm<{ date: string; problemId: string; status: DailyProblem['status'] }>()
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ProblemOption[]>([])

  useEffect(() => {
    fetchProblemOptions().then(setOptions)
  }, [])

  function reload() { actionRef.current?.reload() }
  function openCreate() {
    form.setFieldsValue({ date: '', problemId: undefined as never, status: 'published' })
    setOpen(true)
  }
  async function submit() {
    const values = await form.validateFields()

    try {
      await adminFetch('/admin/daily-practice', {
        method: 'POST',
        body: JSON.stringify({
          date: values.date,
          questionId: values.problemId,
          status: values.status,
        }),
      })

      message.success('每日练习配置已写入后端')
      setOpen(false)
      fetchProblemOptions().then(setOptions)
      reload()
    } catch (error) {
      console.warn('create daily practice failed', error)
      message.error('每日练习配置写入失败，请检查后端服务和网络连通性')
    }
  }

  return (
    <SubjectAwarePageContainer title="每日练习配置" content="根据当前学科配置小程序首页今日学习任务，并关联医护题目。">
      <ProTable<DailyProblemRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={queryBackendDailyProblems}
        toolBarRender={() => [<Button type="primary" key="create" onClick={openCreate}>新增配置</Button>]}
      />
      <Modal title="新增每日练习配置" open={open} onCancel={() => setOpen(false)} onOk={submit} destroyOnClose>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="date" label="日期" rules={[{ required: true, message: '请输入日期' }]}><Input placeholder="例如 2026-05-06" /></Form.Item>
          <Form.Item name="problemId" label="关联题目" rules={[{ required: true, message: '请选择题目' }]}>
            <Select options={options} showSearch optionFilterProp="label" placeholder="仅展示已发布题目" notFoundContent="暂无已发布题目，请先到题目管理发布" />
          </Form.Item>
          <Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item>
        </Form>
      </Modal>
    </SubjectAwarePageContainer>
  )
}
