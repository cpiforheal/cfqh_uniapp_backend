import { Button, Form, Input, Modal, Select, Space, Tag, message } from 'antd'
import { useRef, useState } from 'react'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { ProTable } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { PublishStatusTag } from '@/components/status'
import { statusOptions } from '@/constants/options'
import { deleteNursingEntity, getNursingList, saveNursingEntity, updateNursingEntityStatus } from '@/services/nursingContent'
import type { CaseMaterial } from '@/types/content'

type CaseMaterialRow = CaseMaterial & {
  onEdit?: () => void
  onPublish?: () => void
  onDelete?: () => void
}

const columns: ProColumns<CaseMaterialRow>[] = [
  { title: '案例标题', dataIndex: 'title' },
  { title: '案例背景', dataIndex: 'background', search: false, ellipsis: true },
  { title: '关键词', dataIndex: 'keywords', search: false, render: (_, record) => <Space wrap>{record.keywords.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space> },
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

export default function CaseMaterialsPage() {
  const actionRef = useRef<ActionType>()
  const [form] = Form.useForm<CaseMaterial>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CaseMaterial>()

  function reload() { actionRef.current?.reload() }
  function openCreate() {
    setEditing(undefined)
    form.setFieldsValue({ title: '', background: '', keywords: [], relatedKnowledgeTags: [], analysisFocus: [], status: 'draft' as any })
    setOpen(true)
  }
  function openEdit(record: CaseMaterial) {
    setEditing(record)
    form.setFieldsValue({
      ...record,
      keywords: record.keywords.join('，') as any,
      relatedKnowledgeTags: record.relatedKnowledgeTags.join('，') as any,
      analysisFocus: record.analysisFocus.join('；') as any,
    })
    setOpen(true)
  }
  async function submit() {
    const values = await form.validateFields()
    saveNursingEntity('caseMaterials', {
      title: values.title,
      background: values.background,
      keywords: String(values.keywords).split(/[，,]/).map((item) => item.trim()).filter(Boolean),
      relatedKnowledgeTags: String(values.relatedKnowledgeTags).split(/[，,]/).map((item) => item.trim()).filter(Boolean),
      analysisFocus: String(values.analysisFocus).split(/[；;]/).map((item) => item.trim()).filter(Boolean),
      status: values.status,
    }, editing?.id)
    message.success(editing ? '案例材料已更新' : '案例材料已新增')
    setOpen(false)
    reload()
  }

  const request = async () => {
    const data = getNursingList('caseMaterials')
    const rows: CaseMaterialRow[] = data.map((record) => ({
      ...record,
      onEdit: () => openEdit(record),
      onPublish: () => {
        updateNursingEntityStatus('caseMaterials', record.id, record.status === 'published' ? 'offline' : 'published')
        message.success('案例材料状态已更新')
        reload()
      },
      onDelete: () => {
        deleteNursingEntity('caseMaterials', record.id)
        message.success('案例材料已删除')
        reload()
      },
    }))
    return { data: rows, success: true }
  }

  return (
    <SubjectAwarePageContainer title="案例材料管理" content="维护学习案例、关键词和解析重点，仅面向医护板块。">
      <ProTable<CaseMaterialRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={request}
        toolBarRender={() => [<Button type="primary" key="create" onClick={openCreate}>新增案例材料</Button>]}
      />
      <Modal title={editing ? '编辑案例材料' : '新增案例材料'} open={open} onCancel={() => setOpen(false)} onOk={submit} destroyOnClose>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="title" label="案例标题" rules={[{ required: true, message: '请输入案例标题' }]}><Input /></Form.Item>
          <Form.Item name="background" label="案例背景" rules={[{ required: true, message: '请输入案例背景' }]}><Input.TextArea rows={4} /></Form.Item>
          <Form.Item name="keywords" label="关键词"><Input placeholder="多个关键词用中文逗号分隔" /></Form.Item>
          <Form.Item name="relatedKnowledgeTags" label="相关知识点"><Input placeholder="多个标签用中文逗号分隔" /></Form.Item>
          <Form.Item name="analysisFocus" label="解析重点"><Input placeholder="多个重点用分号分隔" /></Form.Item>
          <Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item>
        </Form>
      </Modal>
    </SubjectAwarePageContainer>
  )
}
