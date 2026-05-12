import { AlertOutlined, DownloadOutlined, FileTextOutlined, LineChartOutlined, PlaySquareOutlined, TeamOutlined, WarningOutlined } from '@ant-design/icons'
import { ProCard, StatisticCard } from '@ant-design/pro-components'
import { Alert, Col, List, Progress, Row, Space, Tag, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { describeAdminFetchError } from '@/services/adminApi'
import { queryAdminAlerts, queryAdminAnalytics, queryAdminTrends, queryAdminVisibility } from '@/services/adminNursing'
import type { AdminAnalytics, AdminVisibility } from '@/types/content'

type AlertsData = {
  inactive: Array<{ openId: string; nickname: string; lastLoginAt: string | null }>
  expiringTokens: Array<{ code: string; boundOpenId: string | null; expiresAt: string }>
  lowAccuracyQuestions: Array<{ questionId: string; title: string; total: number; wrongRate: number }>
}

type TrendPoint = { date: string; practiceCount: number; correctRate: number; activeUsers: number }

function navigate(path: string) {
  window.location.hash = `#${path}`
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<AdminAnalytics>()
  const [visibility, setVisibility] = useState<AdminVisibility>()
  const [alerts, setAlerts] = useState<AlertsData>()
  const [trends, setTrends] = useState<TrendPoint[]>([])

  useEffect(() => {
    async function loadDashboard() {
      const [analyticsResult, visibilityResult, alertsResult, trendsResult] = await Promise.allSettled([
        queryAdminAnalytics(),
        queryAdminVisibility(),
        queryAdminAlerts(),
        queryAdminTrends(7),
      ])

      if (analyticsResult.status === 'fulfilled') {
        setAnalytics(analyticsResult.value)
      }
      if (visibilityResult.status === 'fulfilled') {
        setVisibility(visibilityResult.value)
      }
      if (alertsResult.status === 'fulfilled') {
        setAlerts(alertsResult.value)
      }
      if (trendsResult.status === 'fulfilled') {
        setTrends(trendsResult.value || [])
      }

      const coreError = analyticsResult.status === 'rejected'
        ? analyticsResult.reason
        : visibilityResult.status === 'rejected'
          ? visibilityResult.reason
          : null
      if (coreError) {
        console.warn('dashboard core load failed', coreError)
        message.warning(describeAdminFetchError(coreError, '后台统计加载失败，请检查后端服务'))
        return
      }

      const optionalError = alertsResult.status === 'rejected'
        ? alertsResult.reason
        : trendsResult.status === 'rejected'
          ? trendsResult.reason
          : null
      if (optionalError) {
        console.warn('dashboard optional load failed', optionalError)
        message.warning(describeAdminFetchError(optionalError, '趋势/预警数据暂不可用，请确认后端已重启到最新版本'))
      }
    }

    loadDashboard()
      .catch((error) => {
        console.warn('dashboard load failed', error)
        message.warning(describeAdminFetchError(error, '后台统计加载失败，请检查后端服务'))
      })
  }, [])

  const publishedQuestions = visibility?.modules.reduce((sum, item) => sum + item.publishedQuestions, 0) ?? 0
  const publishedVideos = visibility?.modules.reduce((sum, item) => sum + item.publishedVideos, 0) ?? 0
  const moduleStats = analytics?.moduleStats || []

  const totalAlerts = (alerts?.inactive.length ?? 0) + (alerts?.expiringTokens.length ?? 0) + (alerts?.lowAccuracyQuestions.length ?? 0)

  const weekTrend = trends.length >= 2
    ? { practiceChange: trends[trends.length - 1].practiceCount - trends[0].practiceCount, rateChange: trends[trends.length - 1].correctRate - trends[0].correctRate }
    : null

  return (
    <SubjectAwarePageContainer title="班级总览" content="行动优先：预警 → 趋势 → 详情" showGuardrail={false}>
      {totalAlerts > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <ProCard title={<Space><AlertOutlined style={{ color: '#faad14' }} /><span>需要关注 ({totalAlerts})</span></Space>} headerBordered>
              <Row gutter={[16, 12]}>
                {(alerts?.inactive.length ?? 0) > 0 && (
                  <Col xs={24} md={8}>
                    <Alert
                      type="warning"
                      showIcon
                      icon={<TeamOutlined />}
                      message={`${alerts!.inactive.length} 人超过 3 天未活跃`}
                      description={alerts!.inactive.slice(0, 3).map((s) => s.nickname).join('、') + (alerts!.inactive.length > 3 ? '...' : '')}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate('/nursing/students')}
                    />
                  </Col>
                )}
                {(alerts?.expiringTokens.length ?? 0) > 0 && (
                  <Col xs={24} md={8}>
                    <Alert
                      type="info"
                      showIcon
                      icon={<WarningOutlined />}
                      message={`${alerts!.expiringTokens.length} 个通行码 15 天内到期`}
                      description="点击前往管理"
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate('/nursing/license-tokens')}
                    />
                  </Col>
                )}
                {(alerts?.lowAccuracyQuestions.length ?? 0) > 0 && (
                  <Col xs={24} md={8}>
                    <Alert
                      type="error"
                      showIcon
                      message={`${alerts!.lowAccuracyQuestions.length} 道题正确率低于 40%`}
                      description={alerts!.lowAccuracyQuestions.slice(0, 2).map((q) => q.title.slice(0, 12)).join('、')}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate('/nursing/problems/list')}
                    />
                  </Col>
                )}
              </Row>
            </ProCard>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}><StatisticCard statistic={{ title: '学生总数', value: analytics?.overview.totalStudents ?? 0 }} /></Col>
        <Col xs={12} md={6}><StatisticCard statistic={{ title: '已授权', value: analytics?.overview.authorizedStudents ?? 0 }} /></Col>
        <Col xs={12} md={6}><StatisticCard statistic={{ title: '近7天活跃', value: analytics?.overview.activeStudents7d ?? 0 }} /></Col>
        <Col xs={12} md={6}><StatisticCard statistic={{ title: '整体正确率', value: analytics?.overview.overallCorrectRate ?? 0, suffix: '%' }} /></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={12} md={6}><StatisticCard statistic={{ title: '已发布题目', value: publishedQuestions, suffix: '题' }} chart={<FileTextOutlined style={{ fontSize: 28, color: '#1890ff' }} />} /></Col>
        <Col xs={12} md={6}><StatisticCard statistic={{ title: '已发布视频', value: publishedVideos, suffix: '条' }} chart={<PlaySquareOutlined style={{ fontSize: 28, color: '#52c41a' }} />} /></Col>
        <Col xs={12} md={6}><StatisticCard statistic={{ title: '累计练习', value: analytics?.overview.totalPracticeRecords ?? 0 }} /></Col>
        <Col xs={12} md={6}><StatisticCard statistic={{ title: '本周趋势', value: weekTrend ? `${weekTrend.rateChange >= 0 ? '+' : ''}${weekTrend.rateChange}%` : '-' }} chart={<LineChartOutlined style={{ fontSize: 28, color: weekTrend && weekTrend.rateChange >= 0 ? '#52c41a' : '#ff4d4f' }} />} /></Col>
      </Row>

      {trends.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <ProCard title="7 天趋势" extra={<Tag color="blue">练习量 / 正确率 / 活跃人数</Tag>}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 120 }}>
                {trends.map((t) => (
                  <div key={t.date} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ background: '#5cd6b4', borderRadius: 4, height: Math.max(8, (t.practiceCount / Math.max(...trends.map((x) => x.practiceCount || 1))) * 80), marginBottom: 4 }} />
                    <Typography.Text style={{ fontSize: 11 }}>{t.date.slice(5)}</Typography.Text>
                    <br />
                    <Typography.Text type="secondary" style={{ fontSize: 10 }}>{t.activeUsers}人</Typography.Text>
                  </div>
                ))}
              </div>
            </ProCard>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <ProCard title="模块正确率" extra={<Tag color="blue">按课程模块</Tag>}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {moduleStats.length > 0 ? moduleStats.map((mod) => (
                <Row key={mod.moduleCode} gutter={8} align="middle">
                  <Col span={7}><Typography.Text strong>{mod.moduleName}</Typography.Text></Col>
                  <Col span={13}><Progress percent={mod.correctRate} size="small" strokeColor={mod.correctRate < 60 ? '#ff4d4f' : mod.correctRate < 80 ? '#faad14' : '#52c41a'} /></Col>
                  <Col span={4}><Typography.Text type="secondary">{mod.total} 次</Typography.Text></Col>
                </Row>
              )) : <Typography.Text type="secondary">暂无模块数据</Typography.Text>}
            </Space>
          </ProCard>
        </Col>
        <Col xs={24} lg={12}>
          <ProCard title="高频错题 Top 5" extra={<Tag color="red">近7天错误率最高</Tag>}>
            {(alerts?.lowAccuracyQuestions.length ?? 0) > 0 ? (
              <List
                size="small"
                dataSource={alerts!.lowAccuracyQuestions.slice(0, 5)}
                renderItem={(item, index) => (
                  <List.Item extra={<Tag color="red">错 {item.wrongRate}%</Tag>}>
                    <Space>
                      <Tag>{index + 1}</Tag>
                      <Typography.Text ellipsis style={{ maxWidth: 240 }}>{item.title}</Typography.Text>
                    </Space>
                  </List.Item>
                )}
              />
            ) : <Typography.Text type="secondary">近7天无高错误率题目</Typography.Text>}
          </ProCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <ProCard title="快捷操作">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Typography.Link onClick={() => navigate('/nursing/students')}>查看全部学生训练数据 →</Typography.Link>
              <Typography.Link onClick={() => navigate('/nursing/license-tokens')}>管理授权码 / 批量发码 →</Typography.Link>
              <Typography.Link onClick={() => navigate('/nursing/problems/list')}>维护题库 →</Typography.Link>
              <Typography.Link onClick={() => navigate('/nursing/video-lessons')}>分发视频 →</Typography.Link>
            </Space>
          </ProCard>
        </Col>
        <Col xs={24} lg={12}>
          <ProCard title="数据导出" extra={<DownloadOutlined />}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Typography.Link onClick={() => navigate('/nursing/students')}>导出学生成绩单 (CSV) →</Typography.Link>
              <Typography.Link onClick={() => navigate('/nursing/problems/list')}>导出错题统计 (Excel) →</Typography.Link>
            </Space>
          </ProCard>
        </Col>
      </Row>
    </SubjectAwarePageContainer>
  )
}
