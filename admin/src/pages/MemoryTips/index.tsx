import { Button, Form, Input, Modal, Select, Space, Tag, message } from 'antd'
import { useRef, useState } from 'react'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { ProTable } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { PublishStatusTag } from '@/components/status'
import { statusOptions } from '@/constants/options'
import { deleteNursingEntity, getNursingList, saveNursingEntity, updateNursingEntityStatus } from '@/services/nursingContent'
import type { MemoryTip } from '@/types/content'

type MemoryTipRow = MemoryTip & {
  onEdit?: () => void
  onPublish?: () => void
  onDelete?: () => void
}

const columns: ProColumns<MemoryTipRow>[] = [
  { title: '记忆提示标题', dataIndex: 'title' },
  { title: '提示内容', dataIndex: 'tip', search: false, ellipsis: true },
  { title: '相关知识点', dataIndex: 'relatedKnowledgeTags', search: false, render: (_, record) => <Space wrap>{record.relatedKnowledgeTags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space> },
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
]

export default function MemoryTipsPage() {
  const actionRef = useRef<ActionType>()
  const [form] = Form.useForm<MemoryTip>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MemoryTip>()

  function reload() { actionRef.current?.reload() }
  function openCreate() {
    setEditing(undefined)
    form.setFieldsValue({ title: '', tip: '', relatedKnowledgeTags: [], status: 'draft' as any })
    setOpen(true)
  }
  function openEdit(record: MemoryTip) {
    setEditing(record)
    form.setFieldsValue({ ...record, relatedKnowledgeTags: record.relatedKnowledgeTags.join('，') as any })
    setOpen(true)
  }
  async function submit() {
    const values = await form.validateFields()
    saveNursingEntity('memoryTips', {
      title: values.title,
      tip: values.tip,
      relatedKnowledgeTags: String(values.relatedKnowledgeTags).split(/[，,]/).map((item) => item.trim()).filter(Boolean),
      status: values.status,
    }, editing?.id)
    message.success(editing ? '记忆提示已更新' : '记忆提示已新增')
    setOpen(false)
    reload()
  }

  const request = async () => {
    const data = getNursingList('memoryTips')
    const rows: MemoryTipRow[] = data.map((record) => ({
      ...record,
      onEdit: () => openEdit(record),
      onPublish: () => {
        updateNursingEntityStatus('memoryTips', record.id, record.status === 'published' ? 'offline' : 'published')
        message.success('记忆提示状态已更新')
        reload()
      },
      onDelete: () => {
        deleteNursingEntity('memoryTips', record.id)
        message.success('记忆提示已删除')
        reload()
      },
    }))
    return { data: rows, success: true }
  }

  return (
    <SubjectAwarePageContainer title="记忆提示管理" content="维护医护板块的口诀、记忆提示和复习提醒。">
      <ProTable<MemoryTipRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={request}
        toolBarRender={() => [<Button type="primary" key="create" onClick={openCreate}>新增记忆提示</Button>]}
      />
      <Modal title={editing ? '编辑记忆提示' : '新增记忆提示'} open={open} onCancel={() => setOpen(false)} onOk={submit} destroyOnClose>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="title" label="记忆提示标题" rules={[{ required: true, message: '请输入标题' }]}><Input /></Form.Item>
          <Form.Item name="tip" label="提示内容" rules={[{ required: true, message: '请输入提示内容' }]}><Input.TextArea rows={4} /></Form.Item>
          <Form.Item name="relatedKnowledgeTags" label="相关知识点"><Input placeholder="多个标签用中文逗号分隔" /></Form.Item>
          <Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item>
        </Form>
      </Modal>
    </SubjectAwarePageContainer>
  )
}
