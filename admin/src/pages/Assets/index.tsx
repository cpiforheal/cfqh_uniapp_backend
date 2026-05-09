import { CheckCircleOutlined, CopyOutlined, DownloadOutlined, EyeOutlined, InboxOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons'
import { ProColumns, ProTable } from '@ant-design/pro-components'
import { Alert, Button, Card, Drawer, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Tag, Typography, message } from 'antd'
import { useRef, useState } from 'react'
import type { ActionType } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { PublishStatusTag } from '@/components/status'
import { statusOptions } from '@/constants/options'
import { offlineAdminAsset, queryAdminAssets, saveAdminAsset } from '@/services/adminNursing'
import type { VideoAsset } from '@/types/content'

type AssetRow = VideoAsset & { onEdit?: () => void; onOffline?: () => void }

function isHttpUrl(value?: string) {
  return /^https?:\/\//i.test(String(value || '').trim())
}

function isLikelyVideoUrl(value?: string) {
  const url = String(value || '').trim()
  return isHttpUrl(url) && (/\.(mp4|m3u8|mov|webm)(\?|#|$)/i.test(url) || url.includes('.myqcloud.com') || url.includes('cos.'))
}

function suggestFileKeyFromUrl(value?: string) {
  try {
    const url = new URL(String(value || '').trim())
    const pathname = decodeURIComponent(url.pathname).replace(/^\//, '')
    return pathname || `cos/video/${Date.now()}.mp4`
  } catch {
    return `cos/video/${Date.now()}.mp4`
  }
}

function copyText(value?: string, label = 'fileKey') {
  if (!value) {
    message.warning(`暂无可复制${label}`)
    return
  }
  navigator.clipboard?.writeText(value)
  message.success(`${label} 已复制，可粘贴到视频分发页的素材 Key`)
}

function AssetPreview({ record }: { record: VideoAsset }) {
  return (
    <Card size="small" className="nursing-muted-card" style={{ width: 360 }}>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <div className="nursing-cover-thumb" style={{ width: '100%', height: 120 }}>
          <Space direction="vertical" align="center">
            <InboxOutlined style={{ fontSize: 28 }} />
            <Typography.Text type="secondary">COS 视频链接登记</Typography.Text>
          </Space>
        </div>
        <Typography.Text strong>{record.filename}</Typography.Text>
        <Typography.Text code copyable={{ text: record.fileKey }}>{record.fileKey}</Typography.Text>
        <Typography.Text code copyable={{ text: record.downloadUrl || '' }}>{record.downloadUrl || '未填写 COS 播放链接'}</Typography.Text>
        <Space wrap>
          <Tag color="cyan">{record.sizeMB} MB</Tag>
          <Tag>{record.source}</Tag>
          <PublishStatusTag status={record.status} />
        </Space>
        <Alert type="success" showIcon message="下一步" description="复制 fileKey 后，到公开讲解管理页填入 assetKey；COS 播放链接可直接填入 videoUrl。" />
      </Space>
    </Card>
  )
}

export default function AssetsPage() {
  const actionRef = useRef<ActionType>()
  const [form] = Form.useForm<VideoAsset>()
  const [preview, setPreview] = useState<VideoAsset>()
  const [editing, setEditing] = useState<VideoAsset>()
  const [open, setOpen] = useState(false)

  function reload() { actionRef.current?.reload() }
  function openCreate() {
    setEditing(undefined)
    form.setFieldsValue({ filename: '', fileKey: '', sizeMB: 0, source: 'cos', downloadUrl: '', status: 'draft' } as any)
    setOpen(true)
  }
  function openEdit(record: VideoAsset) {
    setEditing(record)
    form.setFieldsValue(record)
    setOpen(true)
  }
  function applyCosUrl(value?: string) {
    if (!value) return
    if (!form.getFieldValue('fileKey')) form.setFieldValue('fileKey', suggestFileKeyFromUrl(value))
    if (!form.getFieldValue('filename')) form.setFieldValue('filename', suggestFileKeyFromUrl(value).split('/').pop() || 'cos-video.mp4')
    form.setFieldValue('source', 'cos')
  }
  async function submit() {
    const values = await form.validateFields()
    if (values.downloadUrl && !isLikelyVideoUrl(values.downloadUrl)) {
      Modal.warning({ title: 'COS 链接格式需确认', content: '请填写 http/https 开头的 COS 自定义域名视频链接，建议为 .mp4 或 .m3u8 地址。' })
      return
    }
    try {
      await saveAdminAsset({ ...values, id: editing?.id, subjectCode: 'nursing', source: values.source || 'cos' })
      message.success(editing ? 'COS 素材链接已更新' : 'COS 素材链接已登记')
      setOpen(false)
      reload()
    } catch (error) {
      console.warn('save asset failed', error)
      message.error('素材保存失败，请检查后端服务或后台令牌')
    }
  }

  const columns: ProColumns<AssetRow>[] = [
    { title: '素材预览', dataIndex: 'filename', search: false, width: 110, render: (_, record) => <div className="nursing-cover-thumb" style={{ cursor: 'pointer' }} onClick={() => setPreview(record)}><Space direction="vertical" size={0} align="center"><InboxOutlined /><Typography.Text type="secondary" style={{ fontSize: 12 }}>预览</Typography.Text></Space></div> },
    { title: '文件名', dataIndex: 'filename', ellipsis: true, render: (_, record) => <Space direction="vertical" size={2}><Typography.Text strong>{record.filename}</Typography.Text><Typography.Text type="secondary" style={{ fontSize: 12 }}>COS 链接登记后，可直接分发到小程序播放</Typography.Text></Space> },
    { title: '文件 Key', dataIndex: 'fileKey', search: false, copyable: true, ellipsis: true, width: 260 },
    { title: '大小 MB', dataIndex: 'sizeMB', search: false, width: 90 },
    { title: '来源', dataIndex: 'source', width: 100, render: (_, record) => <Tag color={record.source === 'cos' ? 'cyan' : undefined}>{record.source}</Tag> },
    { title: '状态', dataIndex: 'status', valueType: 'select', width: 110, fieldProps: { options: statusOptions }, render: (_, record) => <PublishStatusTag status={record.status} /> },
    { title: '更新时间', dataIndex: 'updatedAt', search: false, width: 120, renderText: (value) => String(value || '').slice(0, 10) },
    { title: '操作', valueType: 'option', width: 180, render: (_, record) => [<a key="preview" onClick={() => setPreview(record)}><EyeOutlined /> 预览</a>, <a key="copy" onClick={() => copyText(record.fileKey)}><CopyOutlined /> 复制 Key</a>, <a key="download" onClick={() => window.open(record.downloadUrl || record.fileKey, '_blank')}><DownloadOutlined /> 验证</a>, <a key="edit" onClick={() => record.onEdit?.()}>编辑</a>, <Popconfirm key="offline" title="确认下线该素材？" onConfirm={() => record.onOffline?.()}><a style={{ color: '#ff4d4f' }}>下线</a></Popconfirm>] },
  ]

  return (
    <SubjectAwarePageContainer title="COS 视频素材登记" content="不接入 COS 密钥和 SDK，只登记已上传到 COS 的自定义域名播放链接、fileKey 和状态。">
      <Alert showIcon type="info" style={{ marginBottom: 16 }} message="最小闭环：COS 上传完成 → 粘贴自定义域名视频链接 → 保存素材 → 填入视频分发 → 小程序播放" description="请先在 COS 控制台或其它工具上传原视频；后台只登记播放链接，不保存 COS SecretId/SecretKey。建议使用已配置白名单和 HTTPS 的自定义域名。" />
      <ProTable<AssetRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async () => {
          try {
            const data = await queryAdminAssets()
            return { data: data.map((item) => ({ ...item, updatedAt: String(item.updatedAt || '').slice(0, 10), onEdit: () => openEdit(item), onOffline: async () => { await offlineAdminAsset(item.id); message.success('素材已下线'); reload() } })), success: true }
          } catch (error) {
            console.warn('query assets failed', error)
            message.error('素材列表加载失败，请检查后台令牌或后端服务')
            return { data: [], success: true }
          }
        }}
        search={{ labelWidth: 78, span: 8, defaultCollapsed: false }}
        options={{ density: true, fullScreen: true, reload: true }}
        size="small"
        scroll={{ x: 1120 }}
        locale={{ emptyText: <Empty description="暂无 COS 素材链接，请登记已上传视频" /> }}
        expandable={{ expandedRowRender: (record) => <Space direction="vertical" size={8}><Typography.Text type="secondary">验证方式：点击“验证”会打开 COS 播放链接；能正常打开/播放后，再复制 fileKey 到视频分发页。</Typography.Text><Typography.Text code copyable={{ text: record.fileKey }}>fileKey: {record.fileKey}</Typography.Text><Typography.Text code copyable={{ text: record.downloadUrl || '' }}>COS 链接: {record.downloadUrl || '-'}</Typography.Text><Typography.Text type="secondary"><LinkOutlined /> 下一步：复制 fileKey → 视频分发页 assetKey → 填同一个 COS 链接到 videoUrl → 发布</Typography.Text></Space> }}
        toolBarRender={() => [<Tag key="copy-flow" icon={<CopyOutlined />} color="cyan">COS 链接登记模式</Tag>, <Tag key="published-rule" icon={<CheckCircleOutlined />} color="green">已发布素材优先分发</Tag>, <Button type="primary" key="upload" icon={<PlusOutlined />} onClick={openCreate}>登记 COS 视频链接</Button>]}
      />
      <Modal title="COS 素材预览与播放验证" open={!!preview} footer={null} onCancel={() => setPreview(undefined)} destroyOnClose>{preview ? <AssetPreview record={preview} /> : null}</Modal>
      <Drawer title={editing ? '编辑 COS 视频链接' : '登记 COS 视频链接'} open={open} width={620} onClose={() => setOpen(false)} destroyOnClose extra={<Space><Button onClick={() => setOpen(false)}>取消</Button><Button type="primary" onClick={submit}>保存素材</Button></Space>}>
        <Alert showIcon type="success" style={{ marginBottom: 12 }} message="只填写 COS 链接和补充信息" description="粘贴 COS 自定义域名视频链接后，系统会尝试从 URL 路径生成 fileKey 和文件名。" />
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="downloadUrl" label="COS 自定义域名视频链接" rules={[{ required: true, message: '请输入 COS 视频播放链接' }, { validator: async (_, value) => { if (!value || isLikelyVideoUrl(value)) return; throw new Error('请填写 http/https 开头的视频链接，建议为 .mp4 或 .m3u8') } }]}><Input placeholder="https://video.example.com/nursing/vital-signs.mp4" onBlur={(event) => applyCosUrl(event.target.value)} /></Form.Item>
          <Form.Item name="filename" label="文件名" rules={[{ required: true, message: '请输入文件名' }]}><Input placeholder="vital-signs-intro.mp4" /></Form.Item>
          <Form.Item name="fileKey" label="fileKey / 对象路径" rules={[{ required: true, message: '请输入 fileKey' }]}><Input placeholder="nursing/vital-signs-intro.mp4" /></Form.Item>
          <Form.Item name="sizeMB" label="大小 MB"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="source" label="来源"><Select options={[{ label: 'COS', value: 'cos' }, { label: '本地登记', value: 'local' }, { label: 'VOD', value: 'vod' }, { label: 'OSS', value: 'oss' }]} /></Form.Item>
          <Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item>
        </Form>
      </Drawer>
    </SubjectAwarePageContainer>
  )
}
