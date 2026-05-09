import { PageContainer, ProCard } from '@ant-design/pro-components'
import { Alert, Typography } from 'antd'

export default function MathHoldingPage() {
  return (
    <PageContainer title="高数板块入口" content="高数板块当前已收束保留，后续成熟后再继续扩展。">
      <Alert
        showIcon
        type="info"
        message="当前阶段说明"
        description="医护板块是当前主开发方向。高数题库、导入和规则文件都已保留，但暂时不继续扩展业务页面。"
        style={{ marginBottom: 16 }}
      />
      <ProCard bordered>
        <Typography.Paragraph>
          当前高数只保留入口、既有规则与后续扩展能力，不作为当前主操作后台。
        </Typography.Paragraph>
      </ProCard>
    </PageContainer>
  )
}
