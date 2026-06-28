import { CopyOutlined, PlusOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons'
import { ProColumns, ProTable, StatisticCard } from '@ant-design/pro-components'
import { Alert, Button, Col, Empty, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Tag, Typography, message } from 'antd'
import { useMemo, useRef, useState } from 'react'
import type { ActionType } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { describeAdminFetchError } from '@/services/adminApi'
import { batchGenerateLicenseTokens, deleteStudentLicenseToken, disableStudentLicenseToken, extendStudentLicenseToken, issueUnboundLicenseToken, queryAdminLicenseTokens } from '@/services/adminNursing'
import type { AdminLicenseTokenRow } from '@/types/content'

function formatDate(value?: string | null, fallback = '-') {
  return value ? String(value).slice(0, 10) : fallback
}

function formatDateTime(value?: string | null, fallback = '-') {
  if (!value) return fallback
  const date = new Date(value)
  if (isNaN(date.getTime())) return fallback
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

function licenseStatusTag(status?: AdminLicenseTokenRow['status']) {
  if (status === 'bound') return <Tag color="green">已绑定</Tag>
  if (status === 'expired') return <Tag color="orange">已过期</Tag>
  if (status === 'disabled') return <Tag color="red">已禁用</Tag>
  return <Tag>未使用</Tag>
}

function activationReasonText(reason?: string | null) {
  if (reason === 'authorized') return '激活成功'
  if (reason === 'not_found') return '无效码'
  if (reason === 'disabled') return '已禁用'
  if (reason === 'expired') return '已过期'
  if (reason === 'bound_to_other_account') return '绑定他人'
  return reason || '-'
}

function activationResultTag(result?: string | null, reason?: string | null) {
  if (!result) return <Tag>无尝试</Tag>
  if (result === 'success') return <Tag color="green">{activationReasonText(reason)}</Tag>
  return <Tag color="red">{activationReasonText(reason)}</Tag>
}

function riskTag(riskLevel?: string | null, riskReason?: string | null) {
  if (riskLevel === 'high') return <Tag color="red">{riskReason || '多人尝试'}</Tag>
  if (riskLevel === 'medium') return <Tag color="orange">{riskReason || '失败较多'}</Tag>
  return <Tag>正常</Tag>
}

function copyText(value?: string | null) {
  if (!value) {
    message.warning('暂无可复制内容')
    return
  }
  navigator.clipboard?.writeText(value)
  message.success('已复制')
}

function getErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback
  const detail = error.message.replace(/^后台接口请求失败：HTTP \d+\s*/, '').trim()
  try {
    const parsed = JSON.parse(detail) as { message?: unknown }
    return typeof parsed.message === 'string' ? parsed.message : fallback
  } catch {
    return detail || fallback
  }
}

export default function LicenseTokensPage() {
  const actionRef = useRef<ActionType>()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('all')
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchCount, setBatchCount] = useState(10)
  const [batchDays, setBatchDays] = useState(90)
  const [batchGroupTag, setBatchGroupTag] = useState('')
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResult, setBatchResult] = useState<string[]>([])

  async function handleBatchGenerate() {
    setBatchLoading(true)
    try {
      const payload: { count: number; expiresDays: number; groupTag?: string } = { count: batchCount, expiresDays: batchDays }
      if (batchGroupTag.trim()) payload.groupTag = batchGroupTag.trim()
      const result = await batchGenerateLicenseTokens(payload)
      const codes = result.map((item) => item.code)
      setBatchResult(codes)
      message.success(`已生成 ${codes.length} 个授权码`)
      actionRef.current?.reload()
    } catch (error) {
      message.error(describeAdminFetchError(error, '批量生成失败'))
    } finally {
      setBatchLoading(false)
    }
  }

  function exportBatchCsv() {
    if (batchResult.length === 0) return
    const csv = '授权码\n' + batchResult.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `授权码_${new Date().toISOString().slice(0, 10)}_${batchResult.length}个.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  const [latestRows, setLatestRows] = useState<AdminLicenseTokenRow[]>([])

  const summary = useMemo(() => {
    return {
      total: latestRows.length,
      bound: latestRows.filter((item) => item.status === 'bound').length,
      unused: latestRows.filter((item) => item.status === 'unused').length,
      disabled: latestRows.filter((item) => item.status === 'disabled').length,
      risk: latestRows.filter((item) => item.activationAttemptSummary?.riskLevel && item.activationAttemptSummary.riskLevel !== 'normal').length,
    }
  }, [latestRows])

  const columns: ProColumns<AdminLicenseTokenRow>[] = [
    {
      title: '授权码',
      dataIndex: 'code',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text code copyable={{ text: record.code }}>{record.code}</Typography.Text>
          <Typography.Text type="secondary">{record.subjectScope === 'nursing' ? '医护大类' : record.subjectScope}</Typography.Text>
        </Space>
      ),
    },
    { title: '状态', dataIndex: 'status', width: 100, render: (_, record) => licenseStatusTag(record.status) },
    {
      title: '授权尝试',
      width: 170,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            {activationResultTag(record.activationAttemptSummary?.lastAttemptResult, record.activationAttemptSummary?.lastAttemptReason)}
            {riskTag(record.activationAttemptSummary?.riskLevel, record.activationAttemptSummary?.riskReason)}
          </Space>
          <Typography.Text type="secondary">
            {record.activationAttemptSummary?.attemptCount || 0} 次 / {record.activationAttemptSummary?.distinctOpenIdCount || 0} 账号
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '绑定账号',
      dataIndex: 'boundOpenId',
      ellipsis: true,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.user?.nickname || (record.boundOpenId ? '微信用户' : '未绑定')}</Typography.Text>
          {record.boundOpenId ? <Typography.Text type="secondary" copyable={{ text: record.boundOpenId }}>{record.boundOpenId}</Typography.Text> : null}
        </Space>
      ),
    },
    { title: '颁发时间', dataIndex: 'createdAt', width: 120, renderText: (value) => formatDate(value) },
    { title: '绑定时间', dataIndex: 'boundAt', width: 120, renderText: (value) => formatDate(value) },
    { title: '到期时间', dataIndex: 'expiresAt', width: 130, renderText: (value) => formatDate(value, '长期/未设置') },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      render: (_, record) => [
        <Button key="copy" size="small" icon={<CopyOutlined />} onClick={() => copyText(record.code)}>复制</Button>,
        <Button
          key="extend"
          size="small"
          disabled={record.status === 'disabled'}
          onClick={async () => {
            try {
              await extendStudentLicenseToken(record.id, 30)
              message.success('已延期 30 天')
              actionRef.current?.reload()
            } catch (error) {
              console.warn('extend license token failed', error)
              message.error('授权码延期失败')
            }
          }}
        >
          延期
        </Button>,
        <Popconfirm key="disable" title="确认禁用该授权码？" onConfirm={async () => {
          try {
            await disableStudentLicenseToken(record.id)
            message.success('已禁用授权码')
            actionRef.current?.reload()
          } catch (error) {
            console.warn('disable license token failed', error)
            message.error('授权码禁用失败')
          }
        }}>
          <Button size="small" danger disabled={record.status === 'disabled'}>禁用</Button>
        </Popconfirm>,
        <Popconfirm
          key="delete"
          title="确认删除该授权码？"
          description="仅用于清理未使用、已禁用或已过期且不再关联账号授权的记录，删除后不可恢复。"
          onConfirm={async () => {
            try {
              await deleteStudentLicenseToken(record.id)
              message.success('已删除授权码')
              actionRef.current?.reload()
            } catch (error) {
              console.warn('delete license token failed', error)
              message.error(getErrorMessage(error, '授权码删除失败'))
            }
          }}
        >
          <Button size="small" danger disabled={record.status === 'bound'}>删除</Button>
        </Popconfirm>,
      ],
    },
  ]

  return (
    <SubjectAwarePageContainer title="授权码台账" content="记录系统已颁发的所有授权码、绑定账号、状态、颁发时间和到期信息。">
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 12 }}
        message="发码记录以后端为准"
        description="推荐先生成未绑定码，学生首次在小程序激活时绑定真实微信 openId；给指定用户发码只用于已登录账号的定向赋权。长期未使用、已禁用或已过期且不再关联账号授权的码可删除清理。"
      />
      <ProTable<AdminLicenseTokenRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async () => {
          try {
            const rows = await queryAdminLicenseTokens({ keyword: keyword.trim(), status })
            setLatestRows(rows)
            return { data: rows, success: true }
          } catch (error) {
            console.warn('query license tokens failed', error)
            message.error(describeAdminFetchError(error, '授权码台账加载失败，请检查后端服务'))
            return { data: [], success: true }
          }
        }}
        search={false}
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{ emptyText: <Empty description="暂无授权码记录" /> }}
        headerTitle="授权码明细"
        toolBarRender={() => [
          <Button
            key="issue-unused"
            type="primary"
            icon={<PlusOutlined />}
            onClick={async () => {
              try {
                const result = await issueUnboundLicenseToken()
                message.success(`已生成未绑定码：${result.licenseToken.code}`)
                actionRef.current?.reload()
              } catch (error) {
                console.warn('issue unbound license token failed', error)
                message.error(describeAdminFetchError(error, getErrorMessage(error, '未绑定授权码生成失败')))
              }
            }}
          >
            生成未绑定码
          </Button>,
          <Button
            key="batch-generate"
            icon={<DownloadOutlined />}
            onClick={() => setBatchModalOpen(true)}
          >
            批量生成
          </Button>,
          <Input
            key="keyword"
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索授权码 / openId"
            style={{ width: 240 }}
          />,
          <Select
            key="status"
            value={status}
            onChange={setStatus}
            style={{ width: 130 }}
            options={[
              { label: '全部状态', value: 'all' },
              { label: '未使用', value: 'unused' },
              { label: '已绑定', value: 'bound' },
              { label: '已禁用', value: 'disabled' },
              { label: '已过期', value: 'expired' },
              { label: '授权异常', value: 'risk' },
            ]}
          />,
          <Button key="reload" icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>查询</Button>,
        ]}
        expandable={{
          expandedRowRender: (record) => (
            <Row gutter={[12, 10]}>
              <Col xs={24} md={8}><Typography.Text type="secondary">授权码 ID：</Typography.Text><Typography.Text code copyable={{ text: record.id }}>{record.id}</Typography.Text></Col>
              <Col xs={24} md={8}><Typography.Text type="secondary">绑定用户 ID：</Typography.Text><Typography.Text code copyable={record.boundUserId ? { text: record.boundUserId } : undefined}>{record.boundUserId || '-'}</Typography.Text></Col>
              <Col xs={24} md={8}><Typography.Text type="secondary">资源范围：</Typography.Text><Typography.Text>{record.resourceScope || 'all'}</Typography.Text></Col>
              <Col xs={24} md={8}><Typography.Text type="secondary">最大绑定数：</Typography.Text><Typography.Text>{record.maxBindCount}</Typography.Text></Col>
              <Col xs={24} md={8}><Typography.Text type="secondary">更新时间：</Typography.Text><Typography.Text>{formatDate(record.updatedAt)}</Typography.Text></Col>
              <Col span={24}>
                <Typography.Text strong>最近授权尝试</Typography.Text>
              </Col>
              {(record.recentActivationAttempts || []).length === 0 ? (
                <Col span={24}><Typography.Text type="secondary">暂无授权尝试</Typography.Text></Col>
              ) : (
                (record.recentActivationAttempts || []).map((attempt) => (
                  <Col xs={24} key={attempt.id}>
                    <Row gutter={[12, 8]}>
                      <Col xs={24} md={5}><Typography.Text type="secondary">时间：</Typography.Text>{formatDateTime(attempt.createdAt)}</Col>
                      <Col xs={24} md={4}><Typography.Text type="secondary">结果：</Typography.Text>{activationResultTag(attempt.result, attempt.reason)}</Col>
                      <Col xs={24} md={6}><Typography.Text type="secondary">openId：</Typography.Text><Typography.Text copyable={attempt.openId ? { text: attempt.openId } : undefined}>{attempt.openId || '-'}</Typography.Text></Col>
                      <Col xs={24} md={4}><Typography.Text type="secondary">设备：</Typography.Text>{attempt.device || '-'}</Col>
                      <Col xs={24} md={5}><Typography.Text type="secondary">IP：</Typography.Text>{attempt.ip || '-'}</Col>
                    </Row>
                  </Col>
                ))
              )}
            </Row>
          ),
        }}
        tableExtraRender={() => (
          <Row gutter={[12, 12]}>
            <Col xs={24} md={6}><StatisticCard statistic={{ title: '当前筛选总数', value: summary.total }} /></Col>
            <Col xs={24} md={6}><StatisticCard statistic={{ title: '已绑定', value: summary.bound }} /></Col>
            <Col xs={24} md={6}><StatisticCard statistic={{ title: '未使用', value: summary.unused }} /></Col>
            <Col xs={24} md={3}><StatisticCard statistic={{ title: '已禁用', value: summary.disabled }} /></Col>
            <Col xs={24} md={3}><StatisticCard statistic={{ title: '授权异常', value: summary.risk }} /></Col>
          </Row>
        )}
      />
      <Modal
        title="批量生成授权码"
        open={batchModalOpen}
        onCancel={() => { setBatchModalOpen(false); setBatchResult([]) }}
        footer={batchResult.length > 0 ? [
          <Button key="export" type="primary" icon={<DownloadOutlined />} onClick={exportBatchCsv}>导出 CSV</Button>,
          <Button key="copy" onClick={() => { navigator.clipboard?.writeText(batchResult.join('\n')); message.success('已复制全部授权码') }}>复制全部</Button>,
          <Button key="close" onClick={() => { setBatchModalOpen(false); setBatchResult([]) }}>关闭</Button>,
        ] : [
          <Button key="cancel" onClick={() => setBatchModalOpen(false)}>取消</Button>,
          <Button key="generate" type="primary" loading={batchLoading} onClick={handleBatchGenerate}>生成</Button>,
        ]}
      >
        {batchResult.length > 0 ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert message={`已生成 ${batchResult.length} 个授权码`} type="success" showIcon />
            <Typography.Paragraph copyable={{ text: batchResult.join('\n') }} style={{ maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 8, fontFamily: 'monospace', fontSize: 13 }}>
              {batchResult.join('\n')}
            </Typography.Paragraph>
          </Space>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Typography.Text>生成数量</Typography.Text>
              <InputNumber min={1} max={100} value={batchCount} onChange={(v) => setBatchCount(v || 10)} style={{ marginLeft: 12, width: 120 }} />
            </div>
            <div>
              <Typography.Text>有效天数</Typography.Text>
              <InputNumber min={7} max={365} value={batchDays} onChange={(v) => setBatchDays(v || 90)} style={{ marginLeft: 12, width: 120 }} addonAfter="天" />
            </div>
            <div>
              <Typography.Text>班级分组</Typography.Text>
              <Input value={batchGroupTag} onChange={(e) => setBatchGroupTag(e.target.value)} placeholder="可选，如 护理2班" style={{ marginLeft: 12, width: 180 }} />
            </div>
            <Alert message="生成后的授权码为未绑定状态，学生在小程序输入后自动绑定其微信账号。" type="info" showIcon />
          </Space>
        )}
      </Modal>
    </SubjectAwarePageContainer>
  )
}
