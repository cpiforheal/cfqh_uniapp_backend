import { Tag } from 'antd'
import type { PublishStatus } from '@/types/content'

const statusMap: Record<PublishStatus, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  published: { color: 'green', text: '已发布' },
  offline: { color: 'orange', text: '已下线' },
}

export function PublishStatusTag({ status }: { status: PublishStatus }) {
  const item = statusMap[status]
  return <Tag color={item.color}>{item.text}</Tag>
}
