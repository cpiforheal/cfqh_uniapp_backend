import { ProColumns, ProTable, StatisticCard } from '@ant-design/pro-components'
import { Alert, Button, Col, Empty, Input, Popconfirm, Progress, Row, Space, Tag, Typography, message } from 'antd'
import { useRef, useState } from 'react'
import type { ActionType } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { adminFetch } from '@/services/adminApi'
import { disableStudentLicenseToken, extendStudentLicenseToken, issueStudentLicenseToken } from '@/services/adminNursing'
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

  let latestOverview: AdminAnalytics['overview'] | undefined
  let latestModuleStats: AdminAnalytics['moduleStats'] = []
  let latestQuestionStats: AdminAnalytics['questionStats'] = []

  const columns: ProColumns<AdminAnalyticsStudentRow>[] = [
    {
      title: '学生',
      dataIndex: 'nickname',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.nickname}</Typography.Text>
          <Typography.Text type="secondary" copyable={{ text: record.openId }}>{record.openId}</Typography.Text>
        </Space>
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
        message="老师视角：搜索微信号后赋权"
        description="一个微信账号只保留一个有效授权码。重复点击发码会返回现有码；如需延长使用时间，请使用延期操作。"
      />
      <ProTable<AdminAnalyticsStudentRow>
        actionRef={actionRef}
        rowKey="userId"
        columns={columns}
        request={async () => {
          try {
            const analytics = await queryAnalytics()
            latestOverview = analytics.overview
            latestModuleStats = analytics.moduleStats
            latestQuestionStats = analytics.questionStats
            let students = analytics.students
            if (keyword.trim()) {
              const k = keyword.trim().toLowerCase()
              students = students.filter((item) => item.openId.toLowerCase().includes(k) || item.nickname.toLowerCase().includes(k))
            }
            return { data: students, success: true }
          } catch (error) {
            console.warn('query analytics failed', error)
            message.error('学情数据加载失败，请检查后台令牌或后端服务')
            return { data: [], success: true }
          }
        }}
        search={false}
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{ emptyText: <Empty description="暂无真实练习记录" /> }}
        headerTitle="学生练习明细"
        toolBarRender={() => [
          <Input
            key="search"
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索 openId 或 昵称"
            style={{ width: 280 }}
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
