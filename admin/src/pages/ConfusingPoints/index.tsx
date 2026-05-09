import { Button, Form, Input, Modal, Select, message } from 'antd'
import { useRef, useState } from 'react'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { ProTable } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { PublishStatusTag } from '@/components/status'
import { statusOptions } from '@/constants/options'
import { deleteNursingEntity, getNursingList, saveNursingEntity, updateNursingEntityStatus } from '@/services/nursingContent'
import type { ConfusingPoint } from '@/types/content'

type ConfusingPointRow = ConfusingPoint & {
  onEdit?: () => void
  onPublish?: () => void
  onDelete?: () => void
}

const columns: ProColumns<ConfusingPointRow>[] = [
  { title: '易混点标题', dataIndex: 'title' },
  { title: '概念 A', dataIndex: 'leftConcept' },
  { title: '概念 B', dataIndex: 'rightConcept' },
  { title: '对比说明', dataIndex: 'contrastSummary', search: false, ellipsis: true },
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

export default function ConfusingPointsPage() {
  const actionRef = useRef<ActionType>()
  const [form] = Form.useForm<ConfusingPoint>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ConfusingPoint>()

  function reload() { actionRef.current?.reload() }
  function openCreate() {
    setEditing(undefined)
    form.setFieldsValue({ title: '', leftConcept: '', rightConcept: '', contrastSummary: '', status: 'draft' as any })
    setOpen(true)
  }
  function openEdit(record: ConfusingPoint) {
    setEditing(record)
    form.setFieldsValue(record)
    setOpen(true)
  }
  async function submit() {
    const values = await form.validateFields()
    saveNursingEntity('confusingPoints', {
      title: values.title,
      leftConcept: values.leftConcept,
      rightConcept: values.rightConcept,
      contrastSummary: values.contrastSummary,
      status: values.status,
    }, editing?.id)
    message.success(editing ? '易混点已更新' : '易混点已新增')
    setOpen(false)
    reload()
  }

  const request = async () => {
    const data = getNursingList('confusingPoints')
    const rows: ConfusingPointRow[] = data.map((record) => ({
      ...record,
      onEdit: () => openEdit(record),
      onPublish: () => {
        updateNursingEntityStatus('confusingPoints', record.id, record.status === 'published' ? 'offline' : 'published')
        message.success('易混点状态已更新')
        reload()
      },
      onDelete: () => {
        deleteNursingEntity('confusingPoints', record.id)
        message.success('易混点已删除')
        reload()
      },
    }))
    return { data: rows, success: true }
  }

  return (
    <SubjectAwarePageContainer title="易混点管理" content="维护医护知识点中的易混概念与对比说明。">
      <ProTable<ConfusingPointRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={request}
        toolBarRender={() => [<Button type="primary" key="create" onClick={openCreate}>新增易混点</Button>]}
      />
      <Modal title={editing ? '编辑易混点' : '新增易混点'} open={open} onCancel={() => setOpen(false)} onOk={submit} destroyOnClose>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="title" label="易混点标题" rules={[{ required: true, message: '请输入易混点标题' }]}><Input /></Form.Item>
          <Form.Item name="leftConcept" label="概念 A" rules={[{ required: true, message: '请输入概念 A' }]}><Input /></Form.Item>
          <Form.Item name="rightConcept" label="概念 B" rules={[{ required: true, message: '请输入概念 B' }]}><Input /></Form.Item>
          <Form.Item name="contrastSummary" label="对比说明" rules={[{ required: true, message: '请输入对比说明' }]}><Input.TextArea rows={4} /></Form.Item>
          <Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item>
        </Form>
      </Modal>
    </SubjectAwarePageContainer>
  )
}
