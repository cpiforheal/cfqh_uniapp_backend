import { ProColumns, ProTable } from '@ant-design/pro-components'
import { Button, Popconfirm, Progress, Space, Tag, Typography, message } from 'antd'
import { useRef } from 'react'
import type { ActionType } from '@ant-design/pro-components'
import { ContentBlocksPreview } from '@/components/FormulaPreview'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import {
  clearProblemDrafts,
  deleteProblemDraft,
  markProblemDraftImported,
  markProblemDraftReady,
  queryProblemDrafts,
} from '@/services/problemDrafts'
import type { ProblemDraft, ProblemDraftStatus } from '@/types/content'

const statusMap: Record<ProblemDraftStatus, { color: string; text: string }> = {
  needs_review: { color: 'orange', text: '需检查' },
  ready: { color: 'green', text: '可入库' },
  imported: { color: 'blue', text: '已标记入库' },
}

function scoreStatus(score: number) {
  if (score >= 85) return 'success'
  if (score >= 70) return 'normal'
  return 'exception'
}

export default function ProblemDraftsPage() {
  const actionRef = useRef<ActionType>()

  function reload() {
    actionRef.current?.reload()
  }

  const columns: ProColumns<ProblemDraft>[] = [
    { title: '题目标题', dataIndex: 'title' },
    {
      title: '题干预览',
      dataIndex: 'stem',
      search: false,
      render: (_, record) => <ContentBlocksPreview blocks={record.stem.slice(0, 3)} />,
    },
    { title: '题型', dataIndex: 'type', width: 110 },
    { title: '难度', dataIndex: 'difficulty', width: 100 },
    {
      title: '知识点',
      dataIndex: 'knowledgeTags',
      search: false,
      render: (_, record) => <Space wrap>{record.knowledgeTags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space>,
    },
    {
      title: '质量分',
      dataIndex: 'qualityScore',
      search: false,
      width: 150,
      render: (_, record) => <Progress percent={record.qualityScore} size="small" status={scoreStatus(record.qualityScore)} />,
    },
    {
      title: '公式数',
      dataIndex: 'formulaCount',
      search: false,
      width: 90,
      render: (_, record) => <Tag color={record.formulaCount > 0 ? 'purple' : 'default'}>{record.formulaCount}</Tag>,
    },
    {
      title: '清洗状态',
      dataIndex: 'status',
      valueType: 'select',
      fieldProps: {
        options: [
          { label: '需检查', value: 'needs_review' },
          { label: '可入库', value: 'ready' },
          { label: '已标记入库', value: 'imported' },
        ],
      },
      width: 120,
      render: (_, record) => <Tag color={statusMap[record.status].color}>{statusMap[record.status].text}</Tag>,
    },
    {
      title: '问题',
      dataIndex: 'issues',
      search: false,
      render: (_, record) =>
        record.issues.length === 0 ? (
          <Tag color="green">无</Tag>
        ) : (
          <Space wrap>
            {record.issues.map((issue) => (
              <Tag color="red" key={`${issue.field}-${issue.message}`}>
                {issue.message}
              </Tag>
            ))}
          </Space>
        ),
    },
    { title: '更新时间', dataIndex: 'updatedAt', search: false, width: 120 },
    {
      title: '操作',
      valueType: 'option',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            onClick={() => {
              markProblemDraftReady(record.id)
              message.success('已标记为可入库')
              reload()
            }}
          >
            标记可入库
          </Button>
          <Button
            type="link"
            onClick={() => {
              markProblemDraftImported(record.id)
              message.success('已标记入库')
              reload()
            }}
          >
            标记入库
          </Button>
          <Popconfirm
            title="删除草稿"
            onConfirm={() => {
              deleteProblemDraft(record.id)
              message.success('已删除草稿')
              reload()
            }}
          >
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <SubjectAwarePageContainer title="草稿清洗池" content="当前学科的导入草稿会单独存放，优先处理低质量分、缺字段和异常题。">
      <Typography.Paragraph type="secondary">
        当前草稿池按学科隔离保存在浏览器本地存储。高分题建议抽检后批量入库，低分题进入异常处理。
      </Typography.Paragraph>
      <ProTable<ProblemDraft>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={queryProblemDrafts}
        toolBarRender={() => [
          <Popconfirm
            key="clear"
            title="清空草稿池"
            description="只会清空当前学科在当前浏览器中的草稿。"
            onConfirm={() => {
              clearProblemDrafts()
              message.success('草稿池已清空')
              reload()
            }}
          >
            <Button danger>清空当前学科草稿池</Button>
          </Popconfirm>,
        ]}
      />
    </SubjectAwarePageContainer>
  )
}
