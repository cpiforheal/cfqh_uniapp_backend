import { ProColumns, ProTable, StatisticCard } from '@ant-design/pro-components'
import { Alert, Button, Col, Empty, Input, Popconfirm, Progress, Row, Select, Space, Tag, Typography, message } from 'antd'
import { useRef, useState } from 'react'
import type { ActionType } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { adminFetch, describeAdminFetchError } from '@/services/adminApi'
import { disableStudentLicenseToken, extendStudentLicenseToken, issueStudentLicenseToken, issueUnboundLicenseToken, queryAdminExportStudents, updateStudentRemark } from '@/services/adminNursing'
import type { AdminAnalytics, AdminAnalyticsStudentRow } from '@/types/content'

async function queryAnalytics(): Promise<AdminAnalytics> {
  return adminFetch<AdminAnalytics>('/admin/analytics')
}

async function queryStudentTokenId(openId: string): Promise<string | null> {
  const students = await adminFetch<Array<{ authorization?: { licenseToken?: { id?: string } | null } | null }>>(
    `/admin/students?keyword=${encodeURIComponent(openId)}`,
  )
  return students?.[0]?.authorization?.licenseToken?.id || null
}

function licenseStatusTag(status?: AdminAnalyticsStudentRow['licenseStatus']) {
  if (status === 'bound') return <Tag color="green">已绑定</Tag>
  if (status === 'expired') return <Tag color="orange">已过期</Tag>
  if (status === 'disabled') return <Tag color="red">已禁用</Tag>
  if (status === 'unused') return <Tag>未使用</Tag>
  return <Tag>未授权</Tag>
}

function formatDate(value?: string | null, fallback = '-') {
  return value ? String(value).slice(0, 10) : fallback
}

function maskLicenseCode(code?: string | null) {
  if (!code) return '-'
  if (code.length <= 8) return `${code.slice(0, 2)}***${code.slice(-2)}`
  return `${code.slice(0, 4)}****${code.slice(-4)}`
}

export default function StudentsPage() {
  const actionRef = useRef<ActionType>()
  const [keyword, setKeyword] = useState('')
  const [rateFilter, setRateFilter] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [syncFilter, setSyncFilter] = useState<string>('all')
  const [latestOverview, setLatestOverview] = useState<AdminAnalytics['overview']>()
  const [latestModuleStats, setLatestModuleStats] = useState<AdminAnalytics['moduleStats']>([])
  const [latestQuestionStats, setLatestQuestionStats] = useState<AdminAnalytics['questionStats']>([])

  const columns: ProColumns<AdminAnalyticsStudentRow>[] = [
    {
      title: '学员信息',
      dataIndex: 'realName',
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{record.realName || <Typography.Text type="secondary">未填写</Typography.Text>}</Typography.Text>
          {record.className && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{record.className}</Typography.Text>}
          {record.wechatId && <Typography.Text type="secondary" style={{ fontSize: 12 }}>微信：{record.wechatId}</Typography.Text>}
          <Typography.Text type="secondary" copyable={{ text: record.openId }} style={{ fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
            {record.openId.slice(0, 10)}...
          </Typography.Text>
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
    { title: '练习次数', dataIndex: 'practiceCount', sorter: true, search: false, width: 100 },
    { title: '正确率', dataIndex: 'correctRate', search: false, width: 150, render: (_, record) => <Progress percent={record.correctRate} size="small" /> },
    { title: '错题累计', dataIndex: 'mistakeCount', search: false, width: 100, render: (_, record) => <Tag color={record.mistakeCount > 0 ? 'orange' : 'green'}>{record.mistakeCount}</Tag> },
    { title: '坚持天数', dataIndex: 'practiceDays', search: false, width: 100 },
    { title: '近 7 天', dataIndex: 'recentPracticeDays', search: false, width: 90, render: (_, record) => <Tag color={record.recentPracticeDays >= 3 ? 'green' : 'default'}>{record.recentPracticeDays} 天</Tag> },
    { title: '授权状态', dataIndex: 'licenseStatus', search: false, width: 110, render: (_, record) => licenseStatusTag(record.licenseStatus) },
    { title: '授权时间', dataIndex: 'activatedAt', search: false, width: 130, renderText: (value) => formatDate(value) },
    { title: '到期时间', dataIndex: 'expiresAt', search: false, width: 130, renderText: (value) => formatDate(value, '长期/未设置') },
    {
      title: '赋权操作',
      search: false,
      width: 230,
      render: (_, record) => (
        <Space>
          <Popconfirm
            title="确认发放授权码？"
            description="如果该账号已有有效授权码，将直接返回现有码，不会重复生成。"
            onConfirm={async () => {
              try {
                const result = await issueStudentLicenseToken({ openId: record.openId, expiresDays: 30 })
                message.success(`${result.reused ? '已有有效授权码' : '已发放授权码'}：${result.licenseToken.code}`)
                actionRef.current?.reload()
              } catch (error) {
                console.warn('issue token failed', error)
                message.error('发放授权码失败')
              }
            }}
          >
            <Button size="small" type="primary">发码</Button>
          </Popconfirm>
          <Button
            size="small"
            danger
            disabled={!record.licenseCode}
            onClick={async () => {
              try {
                const tokenId = await queryStudentTokenId(record.openId)
                if (!tokenId) return message.warning('未找到授权码记录')
                await disableStudentLicenseToken(tokenId)
                message.success('已禁用授权码')
                actionRef.current?.reload()
              } catch (error) {
                console.warn('disable token failed', error)
                message.error('禁用授权码失败')
              }
            }}
          >
            禁用
          </Button>
          <Button
            size="small"
            disabled={!record.licenseCode}
            onClick={async () => {
              try {
                const tokenId = await queryStudentTokenId(record.openId)
                if (!tokenId) return message.warning('未找到授权码记录')
                await extendStudentLicenseToken(tokenId, 30)
                message.success('已延期 30 天')
                actionRef.current?.reload()
              } catch (error) {
                console.warn('extend token failed', error)
                message.error('授权码延期失败')
              }
            }}
          >
            延期30天
          </Button>
          <Button size="small" type="link" onClick={() => { window.location.hash = `#/nursing/students/${record.openId}` }}>查看</Button>
        </Space>
      ),
    },
  ]

  return (
    <SubjectAwarePageContainer title="学生训练数据" content="从真实练习记录聚合学生正确率、坚持天数、错题累计和模块掌握情况；支持按微信账号检索并确保账号拥有唯一有效授权码。">
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 12 }}
        message="老师视角：优先发未绑定码，已登录学生可定向赋权"
        description="本地测试或小范围内测时，可先生成未绑定码，学生首次在小程序激活时再绑定真实微信 openId。学生已出现在登录台账后，也可以在列表里按 openId 定向发码。"
      />
      <ProTable<AdminAnalyticsStudentRow>
        actionRef={actionRef}
        rowKey="userId"
        columns={columns}
        request={async () => {
          try {
            const analytics = await queryAnalytics()
            setLatestOverview(analytics.overview)
            setLatestModuleStats(analytics.moduleStats)
            setLatestQuestionStats(analytics.questionStats)
            let students = analytics.students
            if (keyword.trim()) {
              const k = keyword.trim().toLowerCase()
              students = students.filter((item) => item.openId.toLowerCase().includes(k) || item.nickname.toLowerCase().includes(k) || (item.remark || '').toLowerCase().includes(k) || (item.realName || '').toLowerCase().includes(k) || (item.className || '').toLowerCase().includes(k) || (item.wechatId || '').toLowerCase().includes(k))
            }
            if (rateFilter === 'low') students = students.filter((s) => s.correctRate < 60)
            else if (rateFilter === 'mid') students = students.filter((s) => s.correctRate >= 60 && s.correctRate < 80)
            else if (rateFilter === 'high') students = students.filter((s) => s.correctRate >= 80)
            if (activeFilter === 'inactive') students = students.filter((s) => s.recentPracticeDays === 0)
            else if (activeFilter === 'active') students = students.filter((s) => s.recentPracticeDays >= 3)
            if (syncFilter === 'unsynced') students = students.filter((s) => !s.realName)
            else if (syncFilter === 'synced') students = students.filter((s) => !!s.realName)
            return { data: students, success: true }
          } catch (error) {
            console.warn('query analytics failed', error)
            message.error(describeAdminFetchError(error, '学情数据加载失败，请检查后台令牌或后端服务'))
            return { data: [], success: true }
          }
        }}
        search={false}
        size="small"
        scroll={{ x: 1420 }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{ emptyText: <Empty description="暂无真实练习记录" /> }}
        headerTitle="学生练习明细"
        toolBarRender={() => [
          <Select
            key="rate"
            value={rateFilter}
            onChange={(v) => { setRateFilter(v); setTimeout(() => actionRef.current?.reload(), 0) }}
            style={{ width: 130 }}
            options={[
              { label: '正确率: 全部', value: 'all' },
              { label: '< 60% 薄弱', value: 'low' },
              { label: '60-80%', value: 'mid' },
              { label: '≥ 80% 优秀', value: 'high' },
            ]}
          />,
          <Select
            key="active"
            value={activeFilter}
            onChange={(v) => { setActiveFilter(v); setTimeout(() => actionRef.current?.reload(), 0) }}
            style={{ width: 130 }}
            options={[
              { label: '活跃度: 全部', value: 'all' },
              { label: '7天未活跃', value: 'inactive' },
              { label: '活跃 ≥3天', value: 'active' },
            ]}
          />,
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
          <Button
            key="export"
            onClick={async () => {
              try {
                const result = await queryAdminExportStudents()
                const rows = result.rows || []
                if (rows.length === 0) { message.info('暂无数据'); return }
                const headers = Object.keys(rows[0])
                const escapeCsv = (v: unknown) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
                const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(','))].join('\n')
                const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `students_${new Date().toISOString().slice(0, 10)}.csv`
                a.click()
                URL.revokeObjectURL(url)
                message.success('导出成功')
              } catch { message.error('导出失败') }
            }}
          >
            导出 CSV
          </Button>,
          <Button
            key="issue-unused"
            type="primary"
            onClick={async () => {
              try {
                const result = await issueUnboundLicenseToken({ expiresDays: 30 })
                message.success(`已生成未绑定码：${result.licenseToken.code}`)
              } catch (error) {
                console.warn('issue unbound token failed', error)
                message.error(describeAdminFetchError(error, '未绑定授权码生成失败'))
              }
            }}
          >
            生成未绑定码
          </Button>,
          <Input
            key="search"
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索姓名 / 班级 / 微信号 / 备注 / openId"
            style={{ width: 220 }}
          />,
          <Button key="reload" onClick={() => actionRef.current?.reload()}>查询</Button>,
        ]}
        expandable={{
          expandedRowRender: (record) => (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Typography.Text strong>授权码二级详情</Typography.Text>
              <Row gutter={[12, 10]}>
                <Col xs={24} md={8}><Typography.Text type="secondary">授权码：</Typography.Text><Typography.Text code copyable={record.licenseCode ? { text: record.licenseCode } : undefined}>{maskLicenseCode(record.licenseCode)}</Typography.Text></Col>
                <Col xs={24} md={8}><Typography.Text type="secondary">码颁发时间：</Typography.Text><Typography.Text>{formatDate(record.licenseIssuedAt)}</Typography.Text></Col>
                <Col xs={24} md={8}><Typography.Text type="secondary">码绑定时间：</Typography.Text><Typography.Text>{formatDate(record.licenseBoundAt)}</Typography.Text></Col>
                <Col xs={24} md={8}><Typography.Text type="secondary">授权激活时间：</Typography.Text><Typography.Text>{formatDate(record.activatedAt)}</Typography.Text></Col>
                <Col xs={24} md={8}><Typography.Text type="secondary">授权到期时间：</Typography.Text><Typography.Text>{formatDate(record.licenseExpiresAt, '长期/未设置')}</Typography.Text></Col>
                <Col xs={24} md={8}><Typography.Text type="secondary">授权码状态：</Typography.Text>{licenseStatusTag(record.licenseStatus)}</Col>
              </Row>
            </Space>
          ),
        }}
        tableExtraRender={() => (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} md={6}><StatisticCard statistic={{ title: '学生数', value: latestOverview?.totalStudents ?? 0 }} /></Col>
              <Col xs={24} md={6}><StatisticCard statistic={{ title: '已授权', value: latestOverview?.authorizedStudents ?? 0 }} /></Col>
              <Col xs={24} md={6}><StatisticCard statistic={{ title: '近 7 天活跃', value: latestOverview?.activeStudents7d ?? 0 }} /></Col>
              <Col xs={24} md={6}><StatisticCard statistic={{ title: '整体正确率', value: latestOverview?.overallCorrectRate ?? 0, suffix: '%' }} /></Col>
            </Row>
            <Row gutter={[12, 12]}>
              <Col xs={24} lg={12}>
                <Typography.Title level={5}>模块正确率</Typography.Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {latestModuleStats.length === 0
                    ? <Typography.Text type="secondary">暂无模块练习数据</Typography.Text>
                    : latestModuleStats.map((item) => (
                        <Space key={item.moduleCode} style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Typography.Text>{item.moduleName}</Typography.Text>
                          <Progress percent={item.correctRate} size="small" style={{ width: 220 }} />
                        </Space>
                      ))}
                </Space>
              </Col>
              <Col xs={24} lg={12}>
                <Typography.Title level={5}>高频错题 Top</Typography.Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {latestQuestionStats.length === 0
                    ? <Typography.Text type="secondary">暂无错题数据</Typography.Text>
                    : latestQuestionStats.slice(0, 5).map((item) => (
                        <Space key={item.questionId} style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Typography.Text ellipsis style={{ maxWidth: 280 }}>{item.title}</Typography.Text>
                          <Tag color="orange">错 {item.wrong}</Tag>
                        </Space>
                      ))}
                </Space>
              </Col>
            </Row>
          </Space>
        )}
      />
    </SubjectAwarePageContainer>
  )
}
