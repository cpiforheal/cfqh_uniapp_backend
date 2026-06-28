import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { ProColumns, ProTable } from '@ant-design/pro-components'
import { Button, Empty, Form, Input, Modal, Popconfirm, Space, Tag, Typography, message } from 'antd'
import { useRef, useState } from 'react'
import type { ActionType } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { describeAdminFetchError } from '@/services/adminApi'
import { createTeacherAccount, disableTeacherAccount, queryAdminUsers, resetTeacherPassword, type AdminUser } from '@/services/adminAuth'

function formatDateTime(value?: string | null, fallback = '-') {
  if (!value) return fallback
  const date = new Date(value)
  if (isNaN(date.getTime())) return fallback
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

function roleTag(role: AdminUser['role']) {
  if (role === 'super_admin') return <Tag color="red">超级管理员</Tag>
  return <Tag color="blue">普通老师</Tag>
}

function statusTag(status: AdminUser['status']) {
  if (status === 'active') return <Tag color="green">启用</Tag>
  return <Tag>已删除</Tag>
}

export default function TeacherAccountsPage() {
  const actionRef = useRef<ActionType>()
  const [createOpen, setCreateOpen] = useState(false)
  const [resetUser, setResetUser] = useState<AdminUser | null>(null)
  const [createForm] = Form.useForm()
  const [resetForm] = Form.useForm()

  async function handleCreate() {
    const values = await createForm.validateFields()
    try {
      await createTeacherAccount(values)
      message.success('已新增老师账号')
      setCreateOpen(false)
      createForm.resetFields()
      actionRef.current?.reload()
    } catch (error) {
      message.error(describeAdminFetchError(error, '老师账号新增失败'))
    }
  }

  async function handleResetPassword() {
    if (!resetUser) return
    const values = await resetForm.validateFields()
    try {
      await resetTeacherPassword(resetUser.id, values.password)
      message.success('已重置老师密码')
      setResetUser(null)
      resetForm.resetFields()
      actionRef.current?.reload()
    } catch (error) {
      message.error(describeAdminFetchError(error, '老师密码重置失败'))
    }
  }

  const columns: ProColumns<AdminUser>[] = [
    {
      title: '账号',
      dataIndex: 'username',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.username}</Typography.Text>
          <Typography.Text type="secondary" code copyable={{ text: record.id }}>{record.id}</Typography.Text>
        </Space>
      ),
    },
    { title: '角色', dataIndex: 'role', width: 130, render: (_, record) => roleTag(record.role) },
    { title: '状态', dataIndex: 'status', width: 100, render: (_, record) => statusTag(record.status) },
    { title: '最近登录', dataIndex: 'lastLoginAt', width: 150, renderText: (value) => formatDateTime(value) },
    { title: '创建时间', dataIndex: 'createdAt', width: 150, renderText: (value) => formatDateTime(value) },
    {
      title: '操作',
      valueType: 'option',
      width: 190,
      render: (_, record) => {
        if (record.role !== 'teacher') return [<Typography.Text key="fixed" type="secondary">默认超级管理员</Typography.Text>]
        return [
          <Button key="reset" size="small" onClick={() => { setResetUser(record); resetForm.resetFields() }}>重置密码</Button>,
          <Popconfirm
            key="delete"
            title="确认删除该老师账号？"
            description="删除后该账号会被禁用，历史审计记录仍会保留。"
            onConfirm={async () => {
              try {
                await disableTeacherAccount(record.id)
                message.success('已删除老师账号')
                actionRef.current?.reload()
              } catch (error) {
                message.error(describeAdminFetchError(error, '老师账号删除失败'))
              }
            }}
          >
            <Button size="small" danger disabled={record.status === 'disabled'}>删除</Button>
          </Popconfirm>,
        ]
      },
    },
  ]

  return (
    <SubjectAwarePageContainer title="老师账号管理" content="超级管理员用于新增、删除和重置普通老师账号；普通老师拥有统一的后台产品维护权限。">
      <ProTable<AdminUser>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async () => {
          try {
            const rows = await queryAdminUsers()
            return { data: rows, success: true }
          } catch (error) {
            console.warn('query admin users failed', error)
            message.error(describeAdminFetchError(error, '老师账号加载失败'))
            return { data: [], success: true }
          }
        }}
        search={false}
        size="small"
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="暂无后台账号" /> }}
        headerTitle="后台账号"
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新增老师</Button>,
          <Button key="reload" icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>刷新</Button>,
        ]}
      />
      <Modal title="新增老师账号" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={handleCreate} destroyOnClose>
        <Form form={createForm} layout="vertical">
          <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input placeholder="如 teacher01" />
          </Form.Item>
          <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 8, message: '请输入至少 8 位密码' }]}>
            <Input.Password placeholder="至少 8 位" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title={`重置密码：${resetUser?.username || ''}`} open={Boolean(resetUser)} onCancel={() => setResetUser(null)} onOk={handleResetPassword} destroyOnClose>
        <Form form={resetForm} layout="vertical">
          <Form.Item name="password" label="新密码" rules={[{ required: true, min: 8, message: '请输入至少 8 位新密码' }]}>
            <Input.Password placeholder="至少 8 位" />
          </Form.Item>
        </Form>
      </Modal>
    </SubjectAwarePageContainer>
  )
}
