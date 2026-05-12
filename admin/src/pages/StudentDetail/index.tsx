import { ArrowLeftOutlined } from '@ant-design/icons'
import { PageContainer, ProCard, StatisticCard } from '@ant-design/pro-components'
import { Alert, Button, Col, Descriptions, Progress, Row, Space, Table, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { queryStudentDetail } from '@/services/adminNursing'

function navigate(path: string) {
  window.location.hash = `#${path}`
}

function useParams(): Record<string, string | undefined> {
  const [, setTick] = useState(0)
  useEffect(() => {
    const handler = () => setTick((t) => t + 1)
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  const match = hash.match(/\/nursing\/students\/([^/?#]+)/)
  return { openId: match?.[1] ? decodeURIComponent(match[1]) : undefined }
}

interface StudentDetail {
  userId: string
  openId: string
  nickname: string
  avatarUrl?: string | null
  practiceCount: number
  correctRate: number
  mistakeCount: number
  favoriteCount: number
  practiceDays: number
  recentPracticeDays: number
  lastActiveAt?: string | null
  licenseCode?: string | null
  licenseStatus?: string | null
  activatedAt?: string | null
  expiresAt?: string | null
  moduleProgress: Array<{
    moduleCode: string
    moduleName: string
    totalQuestions: number
    completedQuestions: number
    correctRate: number
  }>
  recentMistakes: Array<{
    questionId: string
    title: string
    chapter: string
    wrongCount: number
    lastWrongAt: string
  }>
  weeklyActivity: Array<{
    date: string
    count: number
  }>
}

export default function StudentDetailPage() {
  const params = useParams()
  const [data, setData] = useState<StudentDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params.openId) return
    setLoading(true)
    queryStudentDetail(params.openId)
      .then((result) => setData(result as unknown as StudentDetail))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [params.openId])

  if (loading) {
    return <PageContainer title="学生详情"><Alert message="正在加载学生数据..." type="info" /></PageContainer>
  }

  if (!data) {
    return (
      <PageContainer title="学生详情">
        <Alert message="未找到该学生数据，可能 openId 无效或后端接口未就绪。" type="warning" action={<Button onClick={() => navigate('/nursing/students')}>返回列表</Button>} />
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title={data.nickname || '学生详情'}
      subTitle={data.openId}
      extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/nursing/students')}>返回列表</Button>}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><StatisticCard statistic={{ title: '累计练习', value: data.practiceCount, suffix: '题' }} /></Col>
        <Col xs={24} md={6}><StatisticCard statistic={{ title: '正确率', value: data.correctRate, suffix: '%' }} /></Col>
        <Col xs={24} md={6}><StatisticCard statistic={{ title: '错题数', value: data.mistakeCount }} /></Col>
        <Col xs={24} md={6}><StatisticCard statistic={{ title: '坚持天数', value: data.practiceDays, suffix: '天' }} /></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <ProCard title="基本信息">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="昵称">{data.nickname}</Descriptions.Item>
              <Descriptions.Item label="OpenId"><Typography.Text copyable code>{data.openId}</Typography.Text></Descriptions.Item>
              <Descriptions.Item label="通行码">{data.licenseCode || '—'}</Descriptions.Item>
              <Descriptions.Item label="授权状态"><Tag color={data.licenseStatus === 'bound' ? 'green' : 'default'}>{data.licenseStatus || '未知'}</Tag></Descriptions.Item>
              <Descriptions.Item label="激活时间">{data.activatedAt?.slice(0, 10) || '—'}</Descriptions.Item>
              <Descriptions.Item label="到期时间">{data.expiresAt?.slice(0, 10) || '—'}</Descriptions.Item>
              <Descriptions.Item label="最后活跃">{data.lastActiveAt?.slice(0, 16) || '—'}</Descriptions.Item>
              <Descriptions.Item label="近7天活跃">{data.recentPracticeDays} 天</Descriptions.Item>
            </Descriptions>
          </ProCard>
        </Col>
        <Col xs={24} md={12}>
          <ProCard title="近7天练习量">
            <Space direction="vertical" style={{ width: '100%' }}>
              {data.weeklyActivity.length > 0 ? data.weeklyActivity.map((day) => (
                <Row key={day.date} gutter={8} align="middle">
                  <Col span={6}><Typography.Text type="secondary">{day.date.slice(5)}</Typography.Text></Col>
                  <Col span={14}><Progress percent={Math.min(Math.round((day.count / 30) * 100), 100)} size="small" format={() => `${day.count} 题`} /></Col>
                </Row>
              )) : <Typography.Text type="secondary">暂无近期练习数据</Typography.Text>}
            </Space>
          </ProCard>
        </Col>
      </Row>

      <ProCard title="章节进度" style={{ marginTop: 16 }}>
        {data.moduleProgress.length > 0 ? (
          <Row gutter={[16, 12]}>
            {data.moduleProgress.map((mod) => (
              <Col xs={24} md={12} key={mod.moduleCode}>
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  <Row justify="space-between">
                    <Typography.Text strong>{mod.moduleName}</Typography.Text>
                    <Typography.Text type="secondary">{mod.completedQuestions}/{mod.totalQuestions} 题 · 正确率 {mod.correctRate}%</Typography.Text>
                  </Row>
                  <Progress percent={mod.totalQuestions > 0 ? Math.round((mod.completedQuestions / mod.totalQuestions) * 100) : 0} size="small" />
                </Space>
              </Col>
            ))}
          </Row>
        ) : <Typography.Text type="secondary">暂无章节进度数据</Typography.Text>}
      </ProCard>

      <ProCard title="近期错题" style={{ marginTop: 16 }}>
        <Table
          dataSource={data.recentMistakes}
          rowKey="questionId"
          size="small"
          pagination={{ pageSize: 10 }}
          columns={[
            { title: '题目', dataIndex: 'title', ellipsis: true },
            { title: '章节', dataIndex: 'chapter', width: 140 },
            { title: '错误次数', dataIndex: 'wrongCount', width: 90, sorter: (a, b) => a.wrongCount - b.wrongCount },
            { title: '最近错误', dataIndex: 'lastWrongAt', width: 120, render: (v: string) => v?.slice(0, 10) || '—' },
          ]}
        />
      </ProCard>
    </PageContainer>
  )
}
