import { PageContainer, type PageContainerProps } from '@ant-design/pro-components'
import { Alert, Space, Tag, Typography } from 'antd'
import { getCurrentSubject } from '@/services/subjects'

interface SubjectAwarePageContainerProps extends PageContainerProps {
  showSubjectTag?: boolean
  showGuardrail?: boolean
}

export function SubjectAwarePageContainer({
  children,
  showSubjectTag = true,
  showGuardrail = true,
  extra,
  content,
  ...props
}: SubjectAwarePageContainerProps) {
  const subject = getCurrentSubject()
  const isNursing = subject.code === 'nursing'
  const normalizedExtra = Array.isArray(extra) ? extra : extra ? [extra] : []

  const defaultContent = (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Space wrap>
        <Typography.Text type="secondary">当前医护空间</Typography.Text>
        <Tag color={isNursing ? 'cyan' : 'blue'}>{subject.name}</Tag>
        {isNursing ? <Tag color="green">四个一级板块贯通</Tag> : null}
      </Space>
      <Typography.Text type="secondary">
        聚焦医护自学辅助内容维护效率，保留 moduleCode / moduleName / chapter 等字段贯通，不输出医疗建议。
      </Typography.Text>
    </Space>
  )

  return (
    <PageContainer
      {...props}
      content={content ?? defaultContent}
      extra={showSubjectTag ? [
        <Tag key="subject-tag" color={isNursing ? 'cyan' : 'blue'}>
          当前学科：{subject.name}
        </Tag>,
        ...normalizedExtra,
      ] : extra}
    >
      {showGuardrail ? (
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 16 }}
          message="后台维护提示"
          description="仅用于题库、公开讲解与素材元数据整理；内容需保持学习辅助定位，避免营销化表达与个体化诊疗建议。"
        />
      ) : null}
      {children}
    </PageContainer>
  )
}
