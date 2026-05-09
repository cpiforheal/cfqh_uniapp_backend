import { ReloadOutlined } from '@ant-design/icons'
import { ProColumns, ProTable, StatisticCard } from '@ant-design/pro-components'
import { Avatar, Button, Col, Empty, Input, Row, Space, Tag, Typography, message } from 'antd'
import { useMemo, useRef, useState } from 'react'
import type { ActionType } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { queryAdminLoginUsers } from '@/services/adminNursing'
import type { AdminLoginUserRow } from '@/types/content'

function formatDateTime(value?: string | null, fallback = '-') {
  if (!value) return fallback
  return String(value).replace('T', ' ').slice(0, 16)
}

function licenseStatusTag(status?: string | null) {
  if (status === 'bound') return <Tag color="green">已绑定</Tag>
  if (status === 'expired') return <Tag color="orange">已过期</Tag>
  if (status === 'disabled') return <Tag color="red">已禁用</Tag>
  if (status === 'unused') return <Tag>未使用</Tag>
  return <Tag>未激活</Tag>
}

function maskLicenseCode(code?: string | null) {
  if (!code) return '-'
  if (code.length <= 8) return `${code.slice(0, 2)}***${code.slice(-2)}`
  return `${code.slice(0, 4)}****${code.slice(-4)}`
}

export default function LoginUsersPage() {
  const actionRef = useRef<ActionType>()
  const [keyword, setKeyword] = useState('')
  const [latestRows, setLatestRows] = useState<AdminLoginUserRow[]>([])

  const summary = useMemo(() => {
    const active7d = Date.now() - 7 * 24 * 60 * 60 * 1000
    return {
      total: latestRows.length,
      authorized: latestRows.filter((item) => item.authorization?.licenseToken?.status === 'bound').length,
      active7d: latestRows.filter((item) => item.lastLoginAt && new Date(item.lastLoginAt).getTime() >= active7d).length,
      unactivated: latestRows.filter((item) => !item.authorization?.licenseToken).length,
    }
  }, [latestRows])

  const columns: ProColumns<AdminLoginUserRow>[] = [
    {
      title: '微信账号',
      dataIndex: 'nickname',
      render: (_, record) => (
        <Space>
          <Avatar src={record.avatarUrl || undefined}>{(record.nickname || '微').slice(0, 1)}</Avatar>
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{record.nickname || '微信用户'}</Typography.Text>
            <Typography.Text type="secondary" copyable={{ text: record.openId }}>{record.openId}</Typography.Text>
          </Space>
        </Space>
      ),
    },
    { title: '登录次数', dataIndex: 'loginCount', width: 90, search: false },
    { title: '首次进入', dataIndex: 'firstLoginAt', width: 150, renderText: (value) => formatDateTime(value) },
    { title: '最近登录', dataIndex: 'lastLoginAt', width: 150, renderText: (value) => formatDateTime(value) },
    {
      title: '设备环境',
      search: false,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.lastDevice || '-'}</Typography.Text>
          <Typography.Text type="secondary">
            {[record.lastPlatform, record.lastClientEnv, record.lastSdkVersion].filter(Boolean).join(' / ') || '-'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '授权状态',
      width: 130,
      search: false,
      render: (_, record) => licenseStatusTag(record.authorization?.licenseToken?.status),
    },
    {
      title: '授权码',
      width: 150,
      search: false,
      render: (_, record) => (
        <Typography.Text code copyable={record.authorization?.licenseToken?.code ? { text: record.authorization.licenseToken.code } : undefined}>
          {maskLicenseCode(record.authorization?.licenseToken?.code)}
        </Typography.Text>
      ),
    },
  ]

  return (
    <SubjectAwarePageContainer title="小程序登录台账" content="记录进入过小程序的微信账号、真实 openId、最近登录环境和授权绑定情况，用于发码前核验。">
      <ProTable<AdminLoginUserRow>
        actionRef={actionRef}
        rowKey="userId"
        columns={columns}
        request={async () => {
          try {
            const rows = await queryAdminLoginUsers(keyword.trim())
            setLatestRows(rows)
            return { data: rows, success: true }
          } catch (error) {
            console.warn('query login users failed', error)
            message.error('登录台账加载失败，请检查后台令牌或后端服务')
            return { data: [], success: true }
          }
        }}
        search={false}
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{ emptyText: <Empty description="暂无小程序登录记录" /> }}
        headerTitle="访问用户"
        toolBarRender={() => [
          <Input
            key="keyword"
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索 openId / 昵称 / 设备"
            style={{ width: 280 }}
          />,
          <Button key="reload" icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>查询</Button>,
        ]}
        expandable={{
          expandedRowRender: (record) => (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Typography.Text strong>最近登录明细</Typography.Text>
              {record.recentLogs.length === 0 ? (
                <Typography.Text type="secondary">暂无登录明细</Typography.Text>
              ) : (
                record.recentLogs.map((log) => (
                  <Row gutter={[12, 8]} key={log.id}>
                    <Col xs={24} md={5}><Typography.Text type="secondary">时间：</Typography.Text>{formatDateTime(log.createdAt)}</Col>
                    <Col xs={24} md={5}><Typography.Text type="secondary">设备：</Typography.Text>{log.device || '-'}</Col>
                    <Col xs={24} md={4}><Typography.Text type="secondary">平台：</Typography.Text>{log.platform || '-'}</Col>
                    <Col xs={24} md={4}><Typography.Text type="secondary">来源：</Typography.Text>{log.source || '-'}</Col>
                    <Col xs={24} md={6}><Typography.Text type="secondary">IP：</Typography.Text>{log.ip || '-'}</Col>
                  </Row>
                ))
              )}
            </Space>
          ),
        }}
        tableExtraRender={() => (
          <Row gutter={[12, 12]}>
            <Col xs={24} md={6}><StatisticCard statistic={{ title: '访问用户', value: summary.total }} /></Col>
            <Col xs={24} md={6}><StatisticCard statistic={{ title: '已授权', value: summary.authorized }} /></Col>
            <Col xs={24} md={6}><StatisticCard statistic={{ title: '近 7 天登录', value: summary.active7d }} /></Col>
            <Col xs={24} md={6}><StatisticCard statistic={{ title: '未激活', value: summary.unactivated }} /></Col>
          </Row>
        )}
      />
    </SubjectAwarePageContainer>
  )
}
