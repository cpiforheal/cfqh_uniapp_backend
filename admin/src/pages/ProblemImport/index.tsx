import { ProCard, StatisticCard } from '@ant-design/pro-components'
import { Alert, Button, Divider, Empty, Space, Table, Tag, Typography, Upload, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FileWordOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { commitQuestionImport, previewQuestionImport } from '@/services/questionImport'
import type { QuestionImportItem, QuestionImportPreview } from '@/services/questionImport'

function typeLabel(type: QuestionImportItem['type']) {
  if (type === 'multiple_choice') return '多选题'
  if (type === 'judgment') return '判断题'
  if (type === 'short_answer') return '简答题'
  if (type === 'case_analysis') return '案例分析题'
  return '单选题'
}

function getImportErrorMessage(error: unknown) {
  const messageText = error instanceof Error ? error.message : ''
  if (/Failed to fetch|NetworkError|Load failed|Network request failed/i.test(messageText)) {
    return '后端服务未启动或网络不可达，请先确认 API 服务运行在后台配置的地址'
  }
  if (/HTTP 4\d\d|请上传|Word|文档|file/i.test(messageText)) {
    return `题目文档上传或解析失败：${messageText}`
  }
  if (/HTTP 5\d\d/i.test(messageText)) {
    return `后端解析服务异常：${messageText}`
  }
  return messageText || '解析失败，请确认后端服务和 Word 文档格式'
}

function hasIssue(item: QuestionImportItem, keyword: string) {
  return item.issues.some((issue) => issue.message.includes(keyword))
}

export default function ProblemImportPage() {
  const [questionDoc, setQuestionDoc] = useState<File>()
  const [answerDoc, setAnswerDoc] = useState<File>()
  const [preview, setPreview] = useState<QuestionImportPreview>()
  const [previewing, setPreviewing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const previewItems = preview?.items ?? []
  const visibleItems = useMemo(() => previewItems.slice(0, 200), [previewItems])
  const analysisReviewCount = useMemo(
    () => previewItems.filter((item) => item.issues.some((issue) => issue.message.includes('解析'))).length,
    [previewItems],
  )
  const moduleStats = useMemo(() => {
    const map = new Map<string, { moduleName: string; count: number; missingAnswers: number; needsReview: number }>()
    previewItems.forEach((item) => {
      const current = map.get(item.moduleCode) ?? { moduleName: item.moduleName, count: 0, missingAnswers: 0, needsReview: 0 }
      current.count += 1
      if (!item.answer) current.missingAnswers += 1
      if (item.issues.length > 0) current.needsReview += 1
      map.set(item.moduleCode, current)
    })
    return Array.from(map.entries()).map(([moduleCode, value]) => ({ moduleCode, ...value }))
  }, [previewItems])
  const chapterStats = useMemo(() => {
    const map = new Map<string, { moduleName: string; chapter: string; count: number; missingAnswers: number }>()
    previewItems.forEach((item) => {
      const key = `${item.moduleCode}|${item.chapter}`
      const current = map.get(key) ?? { moduleName: item.moduleName, chapter: item.chapter, count: 0, missingAnswers: 0 }
      current.count += 1
      if (!item.answer) current.missingAnswers += 1
      map.set(key, current)
    })
    return Array.from(map.values()).sort((left, right) => right.count - left.count).slice(0, 12)
  }, [previewItems])
  const answerMatchRate = preview?.summary.total ? Math.round((preview.summary.matchedAnswers / preview.summary.total) * 100) : 0

  const columns: ColumnsType<QuestionImportItem> = [
    {
      title: '题目',
      dataIndex: 'title',
      width: 360,
      ellipsis: true,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong ellipsis style={{ maxWidth: 330 }}>{record.title}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{record.moduleName} · {record.chapter} · 第 {record.sequenceNo} 题</Typography.Text>
        </Space>
      ),
    },
    {
      title: '匹配依据',
      dataIndex: 'type',
      width: 240,
      render: (value, record) => (
        <Space direction="vertical" size={2}>
          <Space wrap size={[4, 4]}>
            <Tag>{record.moduleName}</Tag>
            <Tag>{typeLabel(value)}</Tag>
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{record.chapter} · 第 {record.sequenceNo} 题</Typography.Text>
        </Space>
      ),
    },
    {
      title: '答案',
      dataIndex: 'answer',
      width: 80,
      render: (value) => value || <Tag color="orange">缺失</Tag>,
    },
    {
      title: '选项数',
      dataIndex: 'optionsJson',
      width: 80,
      render: (value) => {
        try {
          const options = JSON.parse(value || '[]')
          return Array.isArray(options) ? options.length : 0
        } catch {
          return 0
        }
      },
    },
    {
      title: '检查结果',
      dataIndex: 'issues',
      render: (_, record) => record.issues.length === 0
        ? <Tag color="green">可导入</Tag>
        : <Space wrap>{record.issues.map((issue) => <Tag key={issue.message} color={issue.level === 'error' ? 'red' : 'orange'}>{issue.message}</Tag>)}</Space>,
    },
    {
      title: '匹配说明',
      dataIndex: 'issues',
      width: 180,
      render: (_, record) => {
        if (hasIssue(record, '选项')) return <Tag color="red">题目识别异常</Tag>
        if (!record.answer) return <Tag color="orange">题目已识别，答案未匹配</Tag>
        if (hasIssue(record, '解析')) return <Tag color="gold">答案已匹配，解析需复核</Tag>
        return <Tag color="green">题目与答案已对应</Tag>
      },
    },
  ]

  async function handlePreview() {
    if (!questionDoc) {
      message.warning('请先上传题目 Word 文档')
      return
    }
    setPreviewing(true)
    try {
      const result = await previewQuestionImport(questionDoc, answerDoc)
      setPreview(result)
      if (result.summary.total === 0) {
        message.warning('题目文档未识别到可导入题目，请检查课程、章节、题号和选项格式')
      } else {
        message.success(`已解析 ${result.summary.total} 道题目，匹配答案 ${result.summary.matchedAnswers} 道`)
      }
    } catch (error) {
      console.warn('preview question import failed', error)
      message.error(getImportErrorMessage(error))
    } finally {
      setPreviewing(false)
    }
  }

  async function handleCommit() {
    if (previewItems.length === 0) {
      message.warning('请先完成解析预览')
      return
    }
    const importableItems = previewItems
      .filter((item) => item.issues.every((issue) => issue.level !== 'error'))
      .map((item) => item.issues.length > 0 ? { ...item, source: `${item.source}（需复核：${item.issues.map((issue) => issue.message).join('、')}）` } : item)
    if (importableItems.length === 0) {
      message.warning('当前没有通过基础校验的题目')
      return
    }
    setCommitting(true)
    try {
      const result = await commitQuestionImport(importableItems)
      if (result.failed > 0) {
        message.warning(`已导入 ${result.imported} 道，失败 ${result.failed} 道，请查看后端日志或预览问题`)
      } else {
        message.success(`已导入 ${result.imported} 道题目草稿`)
      }
      window.location.href = '/nursing/problems/list'
    } catch (error) {
      console.warn('commit question import failed', error)
      message.error(getImportErrorMessage(error))
    } finally {
      setCommitting(false)
    }
  }

  async function handleCommitAndPublish() {
    if (previewItems.length === 0) {
      message.warning('请先完成解析预览')
      return
    }
    const publishableItems = previewItems.filter((item) => item.issues.length === 0)
    if (publishableItems.length === 0) {
      message.warning('没有零问题的题目可直接发布，请先导入为草稿后逐个处理')
      return
    }
    setCommitting(true)
    try {
      const result = await commitQuestionImport(publishableItems.map((item) => ({ ...item, status: 'published' as const })) as any)
      if (result.failed > 0) {
        message.warning(`已发布 ${result.imported} 道，失败 ${result.failed} 道`)
      } else {
        message.success(`已直接发布 ${result.imported} 道题目，学生端即刻可见`)
      }
      const remainingItems = previewItems.filter((item) => item.issues.length > 0 && item.issues.every((issue) => issue.level !== 'error'))
      if (remainingItems.length > 0) {
        message.info(`另有 ${remainingItems.length} 道需复核题目未发布，可在题目列表中处理`)
      }
      window.location.href = '/nursing/problems/list'
    } catch (error) {
      console.warn('commit and publish failed', error)
      message.error(getImportErrorMessage(error))
    } finally {
      setCommitting(false)
    }
  }

  const publishableCount = previewItems.filter((item) => item.issues.length === 0).length

  return (
    <SubjectAwarePageContainer title="Docx 题库导入" content="老师上传题目文档和答案解析文档，系统先解析预览，再导入为题库草稿。">
      <Alert
        showIcon
        type="info"
        message="最小闭环：题目 docx + 答案解析 docx → 解析预览 → 导入草稿 → 题目管理发布"
        description="导入结果默认是草稿，不会直接出现在小程序学生端；发布仍在题目管理页完成。当前解析适配“课程/章节/单选题/多选题/A-D 选项”、“序号【答案】解析”和连续题号共用答案等常见格式。"
        style={{ marginBottom: 16 }}
      />
      <ProCard split="vertical">
        <ProCard title="上传文档" colSpan="36%">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Upload.Dragger
              accept=".doc,.docx"
              maxCount={1}
              beforeUpload={(file) => {
                setQuestionDoc(file)
                setPreview(undefined)
                return false
              }}
              onRemove={() => {
                setQuestionDoc(undefined)
                setPreview(undefined)
              }}
            >
              <p className="ant-upload-drag-icon"><FileWordOutlined /></p>
              <p className="ant-upload-text">上传题目 Word 文档</p>
              <p className="ant-upload-hint">例如：核心必刷3000题（2026版）.docx</p>
            </Upload.Dragger>
            <Upload
              accept=".doc,.docx"
              maxCount={1}
              beforeUpload={(file) => {
                setAnswerDoc(file)
                setPreview(undefined)
                return false
              }}
              onRemove={() => {
                setAnswerDoc(undefined)
                setPreview(undefined)
              }}
            >
              <Button icon={<UploadOutlined />}>上传答案解析 Word 文档</Button>
            </Upload>
            <Space>
              <Button type="primary" icon={<InboxOutlined />} loading={previewing} onClick={handlePreview}>解析预览</Button>
              <Button disabled={!preview} loading={committing} onClick={handleCommit}>导入为草稿</Button>
              <Button disabled={!preview || publishableCount === 0} loading={committing} type="primary" ghost onClick={handleCommitAndPublish}>
                一键发布无问题题目{publishableCount > 0 ? `（${publishableCount} 道）` : ''}
              </Button>
            </Space>
          </Space>
        </ProCard>
        <ProCard title="解析结果">
          {!preview ? (
            <Empty description="请先上传文档并解析预览" />
          ) : (
            <>
              <StatisticCard.Group>
                <StatisticCard statistic={{ title: '识别题目', value: preview.summary.total }} />
                <StatisticCard statistic={{ title: '可导入', value: preview.summary.ready }} />
                <StatisticCard statistic={{ title: '需复核', value: preview.summary.needsReview }} />
                <StatisticCard statistic={{ title: '答案匹配', value: preview.summary.matchedAnswers }} />
                <StatisticCard statistic={{ title: '缺答案', value: preview.summary.missingAnswers }} />
                <StatisticCard statistic={{ title: '匹配率', value: answerMatchRate, suffix: '%' }} />
              </StatisticCard.Group>
              <Divider />
              <ProCard title="自动分类结果" size="small" style={{ marginBottom: 12 }}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Space wrap>
                    {moduleStats.map((item) => (
                      <Tag key={item.moduleCode} color={item.missingAnswers > 0 ? 'orange' : 'cyan'}>
                        {item.moduleName}：{item.count} 题 / 缺答案 {item.missingAnswers} / 需复核 {item.needsReview}
                      </Tag>
                    ))}
                  </Space>
                  <Space wrap>
                    {chapterStats.map((item) => (
                      <Tag key={`${item.moduleName}-${item.chapter}`}>
                        {item.moduleName} · {item.chapter}：{item.count} 题{item.missingAnswers ? `，缺答案 ${item.missingAnswers}` : ''}
                      </Tag>
                    ))}
                  </Space>
                </Space>
              </ProCard>
              {preview.summary.missingAnswers > 0 && (
                <Alert
                  showIcon
                  type="warning"
                  message={`有 ${preview.summary.missingAnswers} 道题目未匹配到答案`}
                  description="这表示题目本身已识别成功，但答案解析文档里没有按课程、章节、题号匹配到对应答案；导入后会以草稿保留，答案字段标记为“待补充”。"
                  style={{ marginBottom: 12 }}
                />
              )}
              {preview.summary.missingAnswers === 0 && analysisReviewCount > 0 && (
                <Alert
                  showIcon
                  type="info"
                  message={`答案已全部匹配，${analysisReviewCount} 道题的解析为空或仅有答案`}
                  description="这通常表示答案解析文档对应位置本身没有详细解析；系统会先自动带入答案，老师可在发布前只复核或补充这些解析。"
                  style={{ marginBottom: 12 }}
                />
              )}
              {preview.summary.duplicateCount > 0 && <Alert showIcon type="warning" message={`发现 ${preview.summary.duplicateCount} 个重复导入 ID，建议先检查文档结构。`} style={{ marginBottom: 12 }} />}
              <Table<QuestionImportItem>
                rowKey="id"
                size="small"
                columns={columns}
                dataSource={visibleItems}
                pagination={{ pageSize: 20, showSizeChanger: true }}
                scroll={{ x: 960 }}
              />
              {previewItems.length > visibleItems.length && (
                <Typography.Text type="secondary">当前仅展示前 {visibleItems.length} 道，导入时会处理全部 {previewItems.length} 道。</Typography.Text>
              )}
            </>
          )}
        </ProCard>
      </ProCard>
    </SubjectAwarePageContainer>
  )
}
