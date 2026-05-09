import { PageContainer, ProCard } from '@ant-design/pro-components'
import { Alert, Button, Col, Row, Space, Tag, Typography } from 'antd'
import { subjectOptions } from '@/constants/subjects'
import { setCurrentSubject } from '@/services/subjects'

export default function SubjectWorkspacePage() {
  return (
    <PageContainer title="选择学科" content="请先选择当前要进入的后台板块。">
      <Alert
        showIcon
        type="info"
        message="先选学科，再进入后台"
        description="当前阶段以医护板块为主开发方向。高数入口保留，但暂时不继续展开，只作为后续扩展占位。"
        style={{ marginBottom: 16 }}
      />

      <Row gutter={[16, 16]}>
        {subjectOptions.map((subject) => {
          const isNursing = subject.code === 'nursing'

          return (
            <Col xs={24} md={12} key={subject.code}>
              <ProCard
                bordered
                title={subject.name}
                extra={<Tag color={isNursing ? 'green' : 'blue'}>{subject.code}</Tag>}
              >
                <Typography.Paragraph>{subject.description}</Typography.Paragraph>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type={isNursing ? 'primary' : 'default'}
                    onClick={() => {
                      setCurrentSubject(subject.code)
                      window.location.href = isNursing ? '/dashboard' : '/subjects'
                    }}
                    block
                  >
                    {isNursing ? '进入医护后台' : '进入高数占位入口'}
                  </Button>
                  {!isNursing && (
                    <Typography.Text type="secondary">
                      高数板块已保留，但当前阶段暂时收束，后续成熟后再继续展开。
                    </Typography.Text>
                  )}
                </Space>
              </ProCard>
            </Col>
          )
        })}
      </Row>
    </PageContainer>
  )
}
