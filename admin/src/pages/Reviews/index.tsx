import { ProColumns, ProTable } from '@ant-design/pro-components'
import { Button, Space, Tag } from 'antd'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { queryReviewItems } from '@/services/content'
import type { ReviewItem } from '@/types/content'

const reviewStatusMap = {
  pending: { color: 'gold', text: '待审核' },
  approved: { color: 'green', text: '已通过' },
  rejected: { color: 'red', text: '已退回' },
} as const

const columns: ProColumns<ReviewItem>[] = [
  { title: '内容标题', dataIndex: 'title' },
  { title: '内容类型', dataIndex: 'contentType' },
  { title: '提交人', dataIndex: 'submitter' },
  { title: '审核状态', dataIndex: 'status', render: (_, record) => <Tag color={reviewStatusMap[record.status].color}>{reviewStatusMap[record.status].text}</Tag> },
  { title: '更新时间', dataIndex: 'updatedAt', search: false },
  { title: '操作', valueType: 'option', render: () => <Space><Button type="link">通过</Button><Button type="link" danger>退回</Button></Space> },
]

export default function ReviewsPage() {
  return (
    <SubjectAwarePageContainer title="内容发布审核" content="根据当前学科处理发布前审核，小程序端只展示已发布内容。">
      <ProTable<ReviewItem> rowKey="id" columns={columns} request={queryReviewItems} />
    </SubjectAwarePageContainer>
  )
}
