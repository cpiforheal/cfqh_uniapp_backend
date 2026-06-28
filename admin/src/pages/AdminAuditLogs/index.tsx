import { ReloadOutlined } from '@ant-design/icons'
import { ProColumns, ProTable } from '@ant-design/pro-components'
import { Button, Empty, Space, Tag, Typography, message } from 'antd'
import { useRef } from 'react'
import type { ActionType } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { describeAdminFetchError } from '@/services/adminApi'
import { queryAdminAuditLogs } from '@/services/adminNursing'

interface AdminAuditLogRow {
  id: string
  action: string
  target?: string | null
  detail?: string | null
  operator: string
  createdAt: string
}

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

function actionTag(action: string) {
  if (action.startsWith('license.')) return <Tag color="blue">{action}</Tag>
  if (action.startsWith('question.')) return <Tag color="green">{action}</Tag>
  if (action.startsWith('video.')) return <Tag color="purple">{action}</Tag>
  if (action.startsWith('asset.')) return <Tag color="cyan">{action}</Tag>
  return <Tag>{action}</Tag>
}

function formatDetail(detail?: string | null) {
  if (!detail) return '-'
  try {
    const parsed = JSON.parse(detail) as Record<string, unknown>
    return Object.entries(parsed)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' / ')
  } catch {
    return detail
  }
}

export default function AdminAuditLogsPage() {
  const actionRef = useRef<ActionType>()

  const columns: ProColumns<AdminAuditLogRow>[] = [
    { title: '时间', dataIndex: 'createdAt', width: 150, renderText: (value) => formatDateTime(value) },
    { title: '动作', dataIndex: 'action', width: 170, render: (_, record) => actionTag(record.action) },
    {
      title: '对象',
      dataIndex: 'target',
      width: 220,
      ellipsis: true,
      render: (_, record) => (record.target ? <Typography.Text code copyable={{ text: record.target }}>{record.target}</Typography.Text> : '-'),
    },
    {
      title: '详情',
      dataIndex: 'detail',
      ellipsis: true,
      render: (_, record) => <Typography.Text type="secondary">{formatDetail(record.detail)}</Typography.Text>,
    },
    { title: '操作人', dataIndex: 'operator', width: 100 },
  ]

  return (
    <SubjectAwarePageContainer title="后台操作审计" content="记录授权码、题目、视频和素材的关键维护动作，用于排查上线前后内容与授权状态变化。">
      <ProTable<AdminAuditLogRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async () => {
          try {
            const rows = await queryAdminAuditLogs(100)
            return { data: rows, success: true }
          } catch (error) {
            console.warn('query admin audit logs failed', error)
            message.error(describeAdminFetchError(error, '后台操作审计加载失败，请检查后端服务'))
            return { data: [], success: true }
          }
        }}
        search={false}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: true }}
        locale={{ emptyText: <Empty description="暂无后台操作记录" /> }}
        headerTitle="最近操作"
        toolBarRender={() => [
          <Space key="hint">
            <Typography.Text type="secondary">仅展示最近 100 条关键维护动作</Typography.Text>
          </Space>,
          <Button key="reload" icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>刷新</Button>,
        ]}
      />
    </SubjectAwarePageContainer>
  )
}
