import { Button, Form, Input, InputNumber, Modal, Select, Space, Tag, message } from 'antd'
import { useRef, useState } from 'react'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { ProTable } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { PublishStatusTag } from '@/components/status'
import { statusOptions } from '@/constants/options'
import { queryMemoryTips } from '@/services/content'
import { deleteNursingEntity, getNursingList, saveNursingEntity, updateNursingEntityStatus } from '@/services/nursingContent'
import { getCurrentSubjectCode } from '@/services/subjects'
import type { KnowledgePoint, MemoryTip } from '@/types/content'

type KnowledgePointRow = KnowledgePoint & {
  onEdit?: () => void
  onPublish?: () => void
  onDelete?: () => void
}

const subjectCode = getCurrentSubjectCode()
const isNursing = subjectCode === 'nursing'
const memoryTipsMap = new Map<string, string[]>()
queryMemoryTips().then((result) => {
  result.data.forEach((tip: MemoryTip) => {
    tip.relatedKnowledgeTags.forEach((tag) => {
      const current = memoryTipsMap.get(tag) ?? []
      memoryTipsMap.set(tag, [...current, tip.title])
    })
  })
})

const columns: ProColumns<KnowledgePointRow>[] = isNursing ? [
  { title: '知识点名称', dataIndex: 'name' },
  { title: '所属科目', dataIndex: 'chapter' },
  { title: '排序', dataIndex: 'sort', search: false },
  {
    title: '关联记忆提示',
    dataIndex: 'name',
    search: false,
    render: (_, record) => {
      const tips = memoryTipsMap.get(record.name) ?? []
      return tips.length > 0 ? <Space wrap>{tips.map((tip) => <Tag key={tip}>{tip}</Tag>)}</Space> : <Tag>待补充</Tag>
    },
  },
  { title: '状态', dataIndex: 'status', render: (_, record) => <PublishStatusTag status={record.status} /> },
  { title: '更新时间', dataIndex: 'updatedAt', search: false },
  {
    title: '操作',
    valueType: 'option',
    render: (_, record) => [
      <a key="edit" onClick={() => record.onEdit?.()}>编辑</a>,
      <a key="publish" onClick={() => record.onPublish?.()}>切换状态</a>,
      <a key="delete" onClick={() => record.onDelete?.()}>删除</a>,
    ],
  },
] : [
  { title: '知识点名称', dataIndex: 'name' },
  { title: '章节/科目', dataIndex: 'chapter' },
  { title: '排序', dataIndex: 'sort', search: false },
  { title: '状态', dataIndex: 'status', render: (_, record) => <PublishStatusTag status={record.status} /> },
  { title: '更新时间', dataIndex: 'updatedAt', search: false },
]

export default function KnowledgePointsPage() {
  const actionRef = useRef<ActionType>()
  const [form] = Form.useForm<KnowledgePoint>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<KnowledgePoint>()

  function reload() { actionRef.current?.reload() }
  function openCreate() {
    setEditing(undefined)
    form.setFieldsValue({ chapter: '', name: '', sort: 1, status: 'draft' as any })
    setOpen(true)
  }
  function openEdit(record: KnowledgePoint) {
    setEditing(record)
    form.setFieldsValue(record)
    setOpen(true)
  }
  async function submit() {
    const values = await form.validateFields()
    saveNursingEntity('knowledgePoints', {
      name: values.name,
      chapter: values.chapter,
      sort: values.sort,
      status: values.status,
    }, editing?.id)
    message.success(editing ? '知识点已更新' : '知识点已新增')
    setOpen(false)
    reload()
  }

  const request = async () => {
    const data = isNursing ? getNursingList('knowledgePoints') : []
    const rows: KnowledgePointRow[] = data.map((record) => ({
      ...record,
      onEdit: () => openEdit(record),
      onPublish: () => {
        updateNursingEntityStatus('knowledgePoints', record.id, record.status === 'published' ? 'offline' : 'published')
        message.success('知识点状态已更新')
        reload()
      },
      onDelete: () => {
        deleteNursingEntity('knowledgePoints', record.id)
        message.success('知识点已删除')
        reload()
      },
    }))
    return { data: rows, success: true }
  }

  return (
    <SubjectAwarePageContainer title="知识点管理" content={isNursing ? '医护知识点应突出核心概念、所属科目、易混点与记忆提示。' : '根据当前学科管理题目、微课和案例共用的知识点标签。'}>
      <ProTable<KnowledgePointRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={request}
        toolBarRender={() => [<Button type="primary" key="create" onClick={openCreate}>新增知识点</Button>]}
      />
      <Modal title={editing ? '编辑知识点' : '新增知识点'} open={open} onCancel={() => setOpen(false)} onOk={submit} destroyOnClose>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label="知识点名称" rules={[{ required: true, message: '请输入知识点名称' }]}><Input /></Form.Item>
          <Form.Item name="chapter" label="所属科目" rules={[{ required: true, message: '请输入所属科目' }]}><Input /></Form.Item>
          <Form.Item name="sort" label="排序"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item>
        </Form>
      </Modal>
    </SubjectAwarePageContainer>
  )
}
