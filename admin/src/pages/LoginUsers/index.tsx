import { ReloadOutlined } from '@ant-design/icons'
import { ProColumns, ProTable, StatisticCard } from '@ant-design/pro-components'
import { Button, Col, Empty, Input, Row, Select, Space, Tag, Typography, message } from 'antd'
import { useMemo, useRef, useState } from 'react'
import type { ActionType } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { describeAdminFetchError } from '@/services/adminApi'
import { queryAdminLoginUsers, updateStudentRemark } from '@/services/adminNursing'
import type { AdminLoginUserRow } from '@/types/content'

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

function activationReasonText(reason?: string | null) {
  if (reason === 'authorized') return '激活成功'
  if (reason === 'not_found') return '无效码'
  if (reason === 'disabled') return '已禁用'
  if (reason === 'expired') return '已过期'
  if (reason === 'bound_to_other_account') return '绑定他人'
  return reason || '-'
}

function activationResultTag(result?: string | null, reason?: string | null) {
  if (!result) return <Tag>无尝试</Tag>
  if (result === 'success') return <Tag color="green">{activationReasonText(reason)}</Tag>
  return <Tag color="red">{activationReasonText(reason)}</Tag>
}

function riskTag(riskLevel?: string | null, riskReason?: string | null) {
  if (riskLevel === 'high') return <Tag color="red">{riskReason || '高风险'}</Tag>
  if (riskLevel === 'medium') return <Tag color="orange">{riskReason || '需关注'}</Tag>
  return <Tag>正常</Tag>
}

export default function LoginUsersPage() {
  const actionRef = useRef<ActionType>()
  const [keyword, setKeyword] = useState('')
  const [syncFilter, setSyncFilter] = useState<string>('all')
  const [latestRows, setLatestRows] = useState<AdminLoginUserRow[]>([])

  const summary = useMemo(() => {
    const active7d = Date.now() - 7 * 24 * 60 * 60 * 1000
    return {
      total: latestRows.length,
      authorized: latestRows.filter((item) => item.authorization?.licenseToken?.status === 'bound').length,
      active7d: latestRows.filter((item) => item.lastLoginAt && new Date(item.lastLoginAt).getTime() >= active7d).length,
      practiced: latestRows.filter((item) => (item.practiceSummary?.practiceCount || 0) > 0).length,
      riskUsers: latestRows.filter((item) => item.activationAttemptSummary?.riskLevel && item.activationAttemptSummary.riskLevel !== 'normal').length,
    }
  }, [latestRows])

  const columns: ProColumns<AdminLoginUserRow>[] = [
    {
      title: '学员信息',
      dataIndex: 'realName',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{record.realName || <Typography.Text type="secondary">未填写</Typography.Text>}</Typography.Text>
          {record.className && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{record.className}</Typography.Text>}
          {record.wechatId && <Typography.Text type="secondary" style={{ fontSize: 12 }}>微信：{record.wechatId}</Typography.Text>}
          <Typography.Text type="secondary" copyable={{ text: record.openId }} style={{ fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{record.openId.slice(0, 10)}...</Typography.Text>
        </Space>
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 150,
      search: false,
      render: (_, record) => (
        <Typography.Text
          editable={{
            onChange: async (value) => {
              try {
                await updateStudentRemark(record.userId, value)
                message.success('备注已更新')
                actionRef.current?.reload()
              } catch { message.error('更新失败') }
            },
          }}
        >
          {record.remark || ''}
        </Typography.Text>
      ),
    },
    { title: '登录次数', dataIndex: 'loginCount', width: 90, search: false },
    { title: '最近登录', dataIndex: 'lastLoginAt', width: 150, renderText: (value) => formatDateTime(value) },
    {
      title: '学习状态',
      width: 150,
      search: false,
      render: (_, record) => {
        const practice = record.practiceSummary
        const count = practice?.practiceCount || 0
        return (
          <Space direction="vertical" size={0}>
            <Typography.Text>{count > 0 ? `已做 ${count} 题` : '未开始做题'}</Typography.Text>
            <Typography.Text type="secondary">
              {count > 0 ? `正确率 ${practice?.correctRate || 0}% / 错题 ${practice?.mistakeCount || 0}` : `首次进入 ${formatDateTime(record.firstLoginAt)}`}
            </Typography.Text>
          </Space>
        )
      },
    },
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
      title: '授权尝试',
      width: 160,
      search: false,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            {activationResultTag(record.activationAttemptSummary?.lastAttemptResult, record.activationAttemptSummary?.lastAttemptReason)}
            {riskTag(record.activationAttemptSummary?.riskLevel, record.activationAttemptSummary?.riskReason)}
          </Space>
          <Typography.Text type="secondary">
            {record.activationAttemptSummary?.attemptCount || 0} 次 / {record.activationAttemptSummary?.distinctOpenIdCount || 0} 账号
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
            let rows = await queryAdminLoginUsers(keyword.trim())
            if (syncFilter === 'unsynced') rows = rows.filter((r) => !r.realName)
            else if (syncFilter === 'synced') rows = rows.filter((r) => !!r.realName)
            setLatestRows(rows)
            return { data: rows, success: true }
          } catch (error) {
            console.warn('query login users failed', error)
            message.error(describeAdminFetchError(error, '登录台账加载失败，请检查后台令牌或后端服务'))
            return { data: [], success: true }
          }
        }}
        search={false}
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{ emptyText: <Empty description="暂无小程序登录记录" /> }}
        headerTitle="访问用户"
        toolBarRender={() => [
          <Select
            key="sync"
            value={syncFilter}
            onChange={(v) => { setSyncFilter(v); setTimeout(() => actionRef.current?.reload(), 0) }}
            style={{ width: 130 }}
            options={[
              { label: '资料: 全部', value: 'all' },
              { label: '未完善', value: 'unsynced' },
              { label: '已完善', value: 'synced' },
            ]}
          />,
          <Input
            key="keyword"
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索姓名 / 班级 / 微信号 / 备注 / openId"
            style={{ width: 280 }}
          />,
          <Button key="reload" icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>查询</Button>,
        ]}
        expandable={{
          expandedRowRender: (record) => (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Typography.Text strong>最近授权尝试</Typography.Text>
              {(record.recentActivationAttempts || []).length === 0 ? (
                <Typography.Text type="secondary">暂无授权尝试</Typography.Text>
              ) : (
                (record.recentActivationAttempts || []).map((attempt) => (
                  <Row gutter={[12, 8]} key={attempt.id}>
                    <Col xs={24} md={5}><Typography.Text type="secondary">时间：</Typography.Text>{formatDateTime(attempt.createdAt)}</Col>
                    <Col xs={24} md={4}><Typography.Text type="secondary">结果：</Typography.Text>{activationResultTag(attempt.result, attempt.reason)}</Col>
                    <Col xs={24} md={5}><Typography.Text type="secondary">输入码：</Typography.Text><Typography.Text code>{maskLicenseCode(attempt.codeInput)}</Typography.Text></Col>
                    <Col xs={24} md={4}><Typography.Text type="secondary">设备：</Typography.Text>{attempt.device || '-'}</Col>
                    <Col xs={24} md={6}><Typography.Text type="secondary">IP：</Typography.Text>{attempt.ip || '-'}</Col>
                  </Row>
                ))
              )}
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
            <Col xs={24} md={5}><StatisticCard statistic={{ title: '访问用户', value: summary.total }} /></Col>
            <Col xs={24} md={5}><StatisticCard statistic={{ title: '已授权', value: summary.authorized }} /></Col>
            <Col xs={24} md={5}><StatisticCard statistic={{ title: '已做题', value: summary.practiced }} /></Col>
            <Col xs={24} md={5}><StatisticCard statistic={{ title: '近 7 天登录', value: summary.active7d }} /></Col>
            <Col xs={24} md={4}><StatisticCard statistic={{ title: '授权异常', value: summary.riskUsers }} /></Col>
          </Row>
        )}
      />
    </SubjectAwarePageContainer>
  )
}
