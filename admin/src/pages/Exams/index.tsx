import { PlusOutlined } from '@ant-design/icons'
import { ProTable } from '@ant-design/pro-components'
import { Button, message, Modal, Form, Input, InputNumber, Tag, Space, Popconfirm } from 'antd'
import { useRef, useState } from 'react'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { describeAdminFetchError } from '@/services/adminApi'
import { queryExams, createExam, deleteExam, openExam, closeExam, publishExam } from '@/services/adminExam'
import type { ExamListItem } from '@/services/adminExam'

const statusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  open: { text: '开放中', color: 'green' },
  grading: { text: '批改中', color: 'orange' },
  published: { text: '已公布', color: 'blue' },
}

export default function ExamsPage() {
  const actionRef = useRef<ActionType>()
  const [createVisible, setCreateVisible] = useState(false)
  const [form] = Form.useForm()

  const columns: ProColumns<ExamListItem>[] = [
    { title: '考试名称', dataIndex: 'title', ellipsis: true },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (_, r) => <Tag color={statusMap[r.status]?.color}>{statusMap[r.status]?.text}</Tag>,
    },
    { title: '时长(分)', dataIndex: 'durationMin', width: 90 },
    { title: '满分', dataIndex: 'totalScore', width: 70 },
    { title: '题目数', dataIndex: 'questionCount', width: 80 },
    { title: '考生数', dataIndex: 'studentCount', width: 80 },
    { title: '考试码', dataIndex: 'licenseCount', width: 80 },
    { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime', width: 160 },
    {
      title: '操作', width: 240, valueType: 'option',
      render: (_, record) => (
        <Space size={4}>
          <a onClick={() => window.location.assign(`/nursing/exams/${record.id}`)}>详情</a>
          {record.status === 'draft' && (
            <a onClick={() => handleOpen(record.id)}>开放</a>
          )}
          {record.status === 'open' && (
            <a onClick={() => handleClose(record.id)}>关闭</a>
          )}
          {record.status === 'grading' && (
            <a onClick={() => handlePublish(record.id)}>公布成绩</a>
          )}
          {record.status === 'draft' && (
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
              <a style={{ color: '#ff4d4f' }}>删除</a>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  async function handleCreate(values: { title: string; durationMin: number; totalScore: number; description?: string; maxStudents?: number }) {
    try {
      const created = await createExam(values)
      message.success('创建成功，请继续添加题目')
      setCreateVisible(false)
      form.resetFields()
      window.location.assign(`/nursing/exams/${created.id}`)
    } catch (err) {
      message.error(describeAdminFetchError(err, '创建失败'))
    }
  }

  async function handleOpen(id: string) {
    try {
      await openExam(id)
      message.success('已开放')
      actionRef.current?.reload()
    } catch (err) {
      message.error(describeAdminFetchError(err, '开放失败'))
    }
  }

  async function handleClose(id: string) {
    try {
      await closeExam(id)
      message.success('已关闭，进入批改阶段')
      actionRef.current?.reload()
    } catch (err) {
      message.error(describeAdminFetchError(err, '关闭失败'))
    }
  }

  async function handlePublish(id: string) {
    try {
      await publishExam(id)
      message.success('成绩已公布')
      actionRef.current?.reload()
    } catch (err) {
      message.error(describeAdminFetchError(err, '公布失败'))
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteExam(id)
      message.success('已删除')
      actionRef.current?.reload()
    } catch (err) {
      message.error(describeAdminFetchError(err, '删除失败'))
    }
  }

  return (
    <SubjectAwarePageContainer title="在线模考管理" content="创建考试、管理题目、生成考试码、批改评分">
      <ProTable<ExamListItem>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={false}
        request={async () => {
          try {
            const data = await queryExams()
            return { data, success: true }
          } catch (err) {
            message.error(describeAdminFetchError(err, '加载失败'))
            return { data: [], success: false }
          }
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
            创建考试
          </Button>,
        ]}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="创建考试"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} preserve={false}>
          <Form.Item name="title" label="考试名称" rules={[{ required: true, message: '请输入考试名称' }]}>
            <Input placeholder="如：第一次模拟考试" />
          </Form.Item>
          <Form.Item name="durationMin" label="考试时长（分钟）" rules={[{ required: true }]} initialValue={120}>
            <InputNumber min={10} max={300} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="totalScore" label="满分" rules={[{ required: true }]} initialValue={100}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxStudents" label="最大考生数" initialValue={100}>
            <InputNumber min={1} max={200} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </SubjectAwarePageContainer>
  )
}
