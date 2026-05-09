import { CloudUploadOutlined, FileTextOutlined, PlaySquareOutlined, SafetyCertificateOutlined, TeamOutlined } from '@ant-design/icons'
import { ProCard, StatisticCard } from '@ant-design/pro-components'
import { Alert, Button, Col, Progress, Row, Space, Tag, Timeline, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { queryAdminAnalytics, queryAdminVisibility } from '@/services/adminNursing'
import type { AdminAnalytics, AdminVisibility } from '@/types/content'

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<AdminAnalytics>()
  const [visibility, setVisibility] = useState<AdminVisibility>()

  useEffect(() => {
    Promise.all([queryAdminAnalytics(), queryAdminVisibility()])
      .then(([analyticsData, visibilityData]) => {
        setAnalytics(analyticsData)
        setVisibility(visibilityData)
      })
      .catch((error) => {
        console.warn('dashboard admin data failed', error)
        message.warning('后台统计加载失败，请检查后端服务或后台令牌')
      })
  }, [])

  const publishedQuestions = visibility?.modules.reduce((sum, item) => sum + item.publishedQuestions, 0) ?? 0
  const publishedVideos = visibility?.modules.reduce((sum, item) => sum + item.publishedVideos, 0) ?? 0

  return (
    <SubjectAwarePageContainer title="医护内容工作台" content="围绕题库维护、视频分发、素材准备、学生训练数据四类高频操作组织后台入口。" showGuardrail={false}>
      <ProCard className="nursing-muted-card" style={{ marginBottom: 16 }} bodyStyle={{ padding: 24 }}>
        <Row gutter={[20, 20]} align="middle">
          <Col xs={24} lg={14}>
            <Space direction="vertical" size={10}>
              <Space wrap><Tag color="cyan">医护空间</Tag><Tag color="green">四模块内容维护</Tag><Tag color="blue">老师操作闭环</Tag></Space>
              <Typography.Title level={3} style={{ margin: 0 }}>题目 / 视频 / 素材 / 学情一屏进入</Typography.Title>
              <Typography.Paragraph type="secondary" style={{ margin: 0, maxWidth: 760 }}>后台聚焦老师最常用链路：上传 docx 题目、发布题库、登记原视频素材、分发公开讲解、查看学生训练反馈。</Typography.Paragraph>
            </Space>
          </Col>
          <Col xs={24} lg={10}>
            <Space wrap style={{ justifyContent: 'flex-end', width: '100%' }}>
              <Button type="primary" icon={<FileTextOutlined />} href="/nursing/problems/import">导入 Docx</Button>
              <Button icon={<FileTextOutlined />} href="/nursing/problems/list">维护题库</Button>
              <Button icon={<PlaySquareOutlined />} href="/nursing/video-lessons">分发视频</Button>
              <Button icon={<TeamOutlined />} href="/nursing/students">查看学情</Button>
            </Space>
          </Col>
        </Row>
      </ProCard>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><StatisticCard statistic={{ title: '已发布题目', value: publishedQuestions, suffix: '题' }} /></Col>
        <Col xs={24} md={6}><StatisticCard statistic={{ title: '已发布视频', value: publishedVideos, suffix: '条' }} /></Col>
        <Col xs={24} md={6}><StatisticCard statistic={{ title: '学生数', value: analytics?.overview.totalStudents ?? 0 }} /></Col>
        <Col xs={24} md={6}><StatisticCard statistic={{ title: '整体正确率', value: analytics?.overview.overallCorrectRate ?? 0, suffix: '%' }} /></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={15}>
          <ProCard title="发布可见性预览" extra={<Tag icon={<SafetyCertificateOutlined />} color="cyan">已发布才同步前端</Tag>}>
            <Space direction="vertical" style={{ width: '100%' }} size={10}>
              {visibility?.modules.map((item) => (
                <Row key={item.moduleCode} gutter={[12, 6]} align="middle">
                  <Col span={6}><Typography.Text strong>{item.moduleName}</Typography.Text></Col>
                  <Col span={8}><Progress percent={publishedQuestions ? Math.round((item.publishedQuestions / Math.max(publishedQuestions, 1)) * 100) : 0} size="small" format={() => `题 ${item.publishedQuestions}`} /></Col>
                  <Col span={8}><Progress percent={publishedVideos ? Math.round((item.publishedVideos / Math.max(publishedVideos, 1)) * 100) : 0} size="small" format={() => `视频 ${item.publishedVideos}`} /></Col>
                  <Col span={2}><Tag>{item.draftQuestions + item.draftVideos} 草稿</Tag></Col>
                </Row>
              )) || <Typography.Text type="secondary">正在加载可见性数据...</Typography.Text>}
            </Space>
          </ProCard>
        </Col>
        <Col xs={24} lg={9}>
          <ProCard title="老师维护流程">
            <Timeline items={[{ color: 'cyan', children: <Typography.Text>题目：上传 docx → 草稿清洗 → 发布到四模块题库。</Typography.Text> }, { color: 'blue', children: <Typography.Text>视频：登记原视频素材 → 复制 fileKey → 绑定公开讲解并发布。</Typography.Text> }, { color: 'green', children: <Typography.Text>学情：查看学生正确率、坚持天数、错题 Top。</Typography.Text> }]} />
            <Alert showIcon type="success" message="边界清晰" description="不引入营销、订单、复杂大屏，只打通老师维护内容和查看训练反馈的闭环。" />
          </ProCard>
        </Col>
      </Row>
    </SubjectAwarePageContainer>
  )
}
