import { CheckCircleOutlined, CopyOutlined, InboxOutlined, LinkOutlined, RocketOutlined, UploadOutlined } from '@ant-design/icons'
import { ProColumns, ProTable } from '@ant-design/pro-components'
import { Alert, Button, Col, Divider, Drawer, Empty, Form, Image, Input, InputNumber, Modal, Popconfirm, Progress, Row, Select, Space, Tag, Typography, Upload, message } from 'antd'
import { useMemo, useRef, useState } from 'react'
import type { ActionType } from '@ant-design/pro-components'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { PublishStatusTag } from '@/components/status'
import { difficultyOptions, nursingModuleNameMap, nursingModuleOptions, statusOptions } from '@/constants/options'
import { adminFetch } from '@/services/adminApi'
import { appendAdminOperationLog } from '@/services/adminOperationLog'
import { uploadVideoToVod } from '@/services/vodUpload'
import type { VideoLesson } from '@/types/content'

type VideoRow = VideoLesson & {
  onEdit?: () => void
  onPublish?: () => void
  onDelete?: () => void
}

function copyText(value?: string) {
  if (!value) {
    message.warning('暂无可复制内容')
    return
  }
  navigator.clipboard?.writeText(value)
  message.success('已复制')
}

function normalizeVideo(item: any): VideoLesson {
  return {
    ...item,
    subjectCode: 'nursing',
    knowledgeTags: typeof item.knowledgeTags === 'string' ? item.knowledgeTags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : item.knowledgeTags || [],
    updatedAt: String(item.updatedAt || '').slice(0, 10),
  }
}

function parseKnowledgeTags(value: unknown) {
  return String(value || '').split(/[，,]/).map((item) => item.trim()).filter(Boolean)
}

function isLikelyPlayableVideoUrl(value?: string) {
  const url = String(value || '').trim()
  return /^https?:\/\//i.test(url)
}

function getVideoPublishIssues(video: Partial<VideoLesson>) {
  const issues: string[] = []
  const knowledgeTags = Array.isArray(video.knowledgeTags) ? video.knowledgeTags : parseKnowledgeTags(video.knowledgeTags)

  if (!String(video.title || '').trim()) issues.push('标题')
  if (!String(video.moduleCode || '').trim()) issues.push('一级板块')
  if (knowledgeTags.length < 1) issues.push('至少 1 个知识点')
  if (!String(video.videoUrl || '').trim()) issues.push('videoUrl')
  if (video.videoUrl && !isLikelyPlayableVideoUrl(video.videoUrl)) issues.push('videoUrl 需为 http/https 开头的播放链接')

  return issues
}

function warnVideoPublishIssues(issues: string[]) {
  Modal.warning({
    title: '视频发布前校验未通过',
    content: (
      <Space direction="vertical" size={4}>
        <Typography.Text>请先补齐以下内容后再发布：</Typography.Text>
        {issues.map((issue) => <Typography.Text key={issue}>• {issue}</Typography.Text>)}
      </Space>
    ),
  })
}

export default function VideoLessonsPage() {
  const actionRef = useRef<ActionType>()
  const [form] = Form.useForm<VideoLesson>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<VideoLesson>()
  const [activeModuleCode, setActiveModuleCode] = useState<string>('all')
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  function handlePreviewPlay(url?: string) {
    if (!url) {
      message.warning('该视频暂无播放地址')
      return
    }
    setPreviewUrl(url)
    setPreviewOpen(true)
  }

  function reload() { actionRef.current?.reload() }

  function openCreate() {
    setEditing(undefined)
    setUploading(false)
    setUploadPercent(0)
    form.setFieldsValue({ title: '', moduleCode: 'anatomy', moduleName: '人体解剖学', chapter: '待补充小章节', duration: 10, difficulty: 'basic', knowledgeTags: [] as any, coverUrl: '', assetKey: '', videoUrl: '', status: 'draft' as any })
    setOpen(true)
  }

  function openEdit(record: VideoLesson) {
    setEditing(record)
    setUploading(false)
    setUploadPercent(0)
    form.setFieldsValue({ ...record, knowledgeTags: record.knowledgeTags.join('，') as any })
    setOpen(true)
  }

  async function saveVideo(video: VideoLesson) {
    return adminFetch<VideoLesson>('/admin/videos', { method: 'POST', body: JSON.stringify(video) })
  }

  async function offlineVideo(id: string) {
    return adminFetch<VideoLesson>(`/admin/videos/${id}`, { method: 'DELETE' })
  }

  async function handleVodUpload(file: File) {
    setUploading(true)
    setUploadPercent(0)
    try {
      const result = await uploadVideoToVod(file, setUploadPercent)
      const currentTitle = String(form.getFieldValue('title') || '').trim()
      form.setFieldsValue({
        title: currentTitle || file.name.replace(/\.[^.]+$/, ''),
        assetKey: result.fileId,
        videoUrl: result.videoUrl,
        coverUrl: result.coverUrl || form.getFieldValue('coverUrl') || '',
        status: 'draft' as any,
      })
      message.success('视频已上传到 VOD，播放地址已自动填入。补齐分类和知识点后即可保存/发布')
    } catch (error) {
      console.warn('vod upload failed', error)
      message.error(error instanceof Error ? error.message : 'VOD 上传失败，请检查签名配置和网络')
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    const values = form.getFieldsValue(true)
    const payload: VideoLesson = {
      subjectCode: 'nursing',
      id: editing?.id || '',
      title: values.title || '',
      moduleCode: values.moduleCode || 'anatomy',
      moduleName: nursingModuleNameMap[String(values.moduleCode || 'anatomy')] || '人体解剖学',
      chapter: values.chapter || '待补充小章节',
      duration: values.duration || 10,
      difficulty: values.difficulty || 'basic',
      knowledgeTags: parseKnowledgeTags(values.knowledgeTags),
      coverUrl: values.coverUrl || '',
      assetKey: values.assetKey || '',
      videoUrl: values.videoUrl || '',
      status: values.status || 'draft',
      updatedAt: new Date().toISOString().slice(0, 10),
    }

    if (payload.status === 'published') {
      const issues = getVideoPublishIssues(payload)
      if (issues.length > 0) {
        warnVideoPublishIssues(issues)
        return
      }
    }
    try {
      await saveVideo(payload)
      if (payload.status === 'published' && editing?.status !== 'published') {
        appendAdminOperationLog({ type: 'video_publish', targetId: payload.id || editing?.id, targetTitle: payload.title })
      }
      message.success(`${editing ? '公开讲解已更新并同步' : '公开讲解已新增并同步'}${payload.status === 'published' ? '，已记录操作日志' : ''}`)
      setOpen(false)
      reload()
    } catch (error) {
      console.warn('save video failed', error)
      message.error('公开讲解同步失败，请检查后端服务')
    }
  }

  const request = async () => {
    try {
      const data = await adminFetch<unknown[]>('/admin/videos')
      const rows: VideoRow[] = Array.isArray(data)
        ? data
            .map((item) => normalizeVideo(item))
            .filter((video) => activeModuleCode === 'all' || video.moduleCode === activeModuleCode)
            .map((video) => {
              return {
              ...video,
              onEdit: () => openEdit(video),
              onPublish: async () => {
                const nextStatus: VideoLesson['status'] = video.status === 'published' ? 'offline' : 'published'
                if (nextStatus === 'published') {
                  const issues = getVideoPublishIssues(video)
                  if (issues.length > 0) {
                    warnVideoPublishIssues(issues)
                    return
                  }
                }
                try {
                  await saveVideo({ ...video, status: nextStatus, updatedAt: new Date().toISOString().slice(0, 10) })
                  appendAdminOperationLog({ type: nextStatus === 'published' ? 'video_publish' : 'video_offline', targetId: video.id, targetTitle: video.title })
                  message.success(`公开讲解已${nextStatus === 'published' ? '发布' : '下线'}，已记录操作日志`)
                  reload()
                } catch (error) {
                  console.warn('update video status failed', error)
                  message.error('视频状态同步失败，请检查后端服务')
                }
              },
              onDelete: async () => {
                try {
                  await offlineVideo(video.id)
                  appendAdminOperationLog({ type: 'video_delete', targetId: video.id, targetTitle: video.title })
                  message.success('公开讲解已删除/下线，已记录操作日志')
                  reload()
                } catch (error) {
                  console.warn('delete video failed', error)
                  message.error('视频删除失败，请检查后端服务')
                }
              },
            }
          })
        : []

      return { data: rows, success: true }
    } catch (error) {
      console.warn('query videos failed', error)
      message.error('视频列表加载失败，请确认后端服务是否可用')
      return { data: [], success: true }
    }
  }

  const columns: ProColumns<VideoRow>[] = [
    {
      title: '封面',
      dataIndex: 'coverUrl',
      search: false,
      width: 112,
      render: (_, record) => record.coverUrl ? (
        <Image className="nursing-cover-thumb" src={record.coverUrl} width={88} height={50} style={{ objectFit: 'cover', borderRadius: 10 }} fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='88' height='50'%3E%3Crect width='88' height='50' fill='%23eff8f8'/%3E%3Ctext x='44' y='29' text-anchor='middle' font-size='12' fill='%236b8f93'%3E封面%3C/text%3E%3C/svg%3E" />
      ) : <div className="nursing-cover-thumb">暂无封面</div>,
    },
    { title: '公开讲解标题', dataIndex: 'title', ellipsis: true, width: 240 },
    { title: '一级板块', dataIndex: 'moduleCode', valueType: 'select', width: 150, fieldProps: { options: nursingModuleOptions }, render: (_, record) => <Tag color="cyan">{nursingModuleNameMap[record.moduleCode || ''] || record.moduleName || '-'}</Tag> },
    { title: '难度', dataIndex: 'difficulty', valueType: 'select', width: 100, fieldProps: { options: difficultyOptions } },
    { title: '状态', dataIndex: 'status', valueType: 'select', width: 110, fieldProps: { options: statusOptions }, render: (_, record) => <PublishStatusTag status={record.status} /> },
    { title: '更新时间', dataIndex: 'updatedAt', search: false, width: 120 },
    {
      title: '地址/Key',
      dataIndex: 'assetKey',
      search: false,
      width: 160,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Button size="small" icon={<CopyOutlined />} onClick={() => copyText(record.assetKey)}>素材 Key</Button>
          <Button size="small" type="link" icon={<LinkOutlined />} onClick={() => copyText(record.videoUrl)}>视频地址</Button>
        </Space>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      render: (_, record) => [
        <a key="preview" onClick={() => handlePreviewPlay(record.videoUrl)}>试播</a>,
        <a key="edit" onClick={() => record.onEdit?.()}>编辑</a>,
        <Popconfirm key="publish" title={record.status === 'published' ? '确认下线该视频？' : '确认发布该视频？'} description="发布后小程序视频页可见；下线后不建议继续分发该素材。" onConfirm={() => record.onPublish?.()} okText="确认" cancelText="取消">
          <a>{record.status === 'published' ? '下线' : '发布'}</a>
        </Popconfirm>,
        <Popconfirm key="delete" title="确认删除该视频？" description="删除会调用下线接口，请确认素材引用已处理。" onConfirm={() => record.onDelete?.()} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
          <a style={{ color: '#ff4d4f' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ]

  const moduleTags = useMemo(
    () => [{ label: '全部模块', value: 'all' }, ...nursingModuleOptions.map((item) => ({ label: item.label, value: String(item.value) }))],
    [],
  )

  return (
    <SubjectAwarePageContainer title="公开讲解管理" content="上传到腾讯云 VOD 或登记已有播放链接，维护封面、四模块归属和发布状态，发布后小程序直接播放 videoUrl。">
      <Alert showIcon type="info" style={{ marginBottom: 12 }} message="VOD 直传分发流：选择视频 → 浏览器直传腾讯云 VOD → 自动回填 FileId 和播放地址 → 保存草稿/发布" description="后端只生成短期上传签名，不中转视频文件；若已有 COS/CDN/其他 HTTPS 播放链接，也可以手动登记为兜底方案。" />
      <Space wrap style={{ marginBottom: 10 }}>
        {moduleTags.map((tag) => (
          <Tag
            key={tag.value}
            color={activeModuleCode === tag.value ? 'cyan' : 'default'}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              setActiveModuleCode(tag.value)
              actionRef.current?.reload()
            }}
          >
            {tag.label}
          </Tag>
        ))}
      </Space>
      <ProTable<VideoRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={request}
        search={{ labelWidth: 78, span: 6, defaultCollapsed: false }}
        options={{ density: true, fullScreen: true, reload: true }}
        size="small"
        scroll={{ x: 1120 }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{ emptyText: <Empty description="暂无公开讲解，请先新增视频分发元数据" /> }}
        expandable={{
          expandedRowRender: (record) => (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space wrap size={[12, 6]}>
                <Typography.Text type="secondary">小章节：{record.chapter || '-'}</Typography.Text>
                <Typography.Text type="secondary">时长：{record.duration || 0} 分钟</Typography.Text>
                <Space wrap size={[4, 4]}>{record.knowledgeTags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space>
              </Space>
              <Typography.Text code copyable={{ text: record.assetKey || '' }}>assetKey: {record.assetKey || '-'}</Typography.Text>
              <Typography.Text code copyable={{ text: record.videoUrl || '' }}>videoUrl: {record.videoUrl || '-'}</Typography.Text>
            </Space>
          ),
        }}
        toolBarRender={() => [
          <Tag key="asset-step" icon={<InboxOutlined />} color="cyan">assetKey 对齐 VOD FileId</Tag>,
          <Tag key="visible-rule" icon={<CheckCircleOutlined />} color="green">已发布才分发到小程序</Tag>,
          <Button type="primary" key="create" icon={<RocketOutlined />} onClick={openCreate}>新增公开讲解</Button>,
        ]}
      />
      <Drawer
        title={editing ? '编辑公开讲解' : '新增公开讲解'}
        open={open}
        width={760}
        onClose={() => setOpen(false)}
        destroyOnClose
        extra={<Space><Button onClick={() => setOpen(false)}>取消</Button><Button type="primary" loading={uploading} onClick={submit}>保存并同步</Button></Space>}
      >
        <Alert showIcon type="success" style={{ marginBottom: 12 }} message="上传或登记播放信息" description="优先上传到腾讯云 VOD，系统会自动回填 VOD FileId 与播放地址；手上已有可访问的 HTTPS 视频地址时，也可以直接粘贴。" />
        <Form form={form} layout="vertical" preserve={false}>
          <Typography.Title level={5} className="nursing-section-title">基础信息</Typography.Title>
          <Row gutter={[12, 0]}>
            <Col span={24}><Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}><Input placeholder="公开讲解标题" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="moduleCode" label="一级板块" rules={[{ required: true, message: '请选择一级板块' }]}><Select options={nursingModuleOptions} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="chapter" label="小章节（预留）"><Input placeholder="例如：运动系统" /></Form.Item></Col>
            <Col xs={24} md={4}><Form.Item name="duration" label="时长（分钟）"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="difficulty" label="难度"><Select options={difficultyOptions} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="knowledgeTags" label="知识点标签" tooltip="多个标签用中文逗号或英文逗号分隔"><Input placeholder="生命体征，病情观察" /></Form.Item></Col>
          </Row>
          <Divider style={{ margin: '10px 0 12px' }} />
          <Typography.Title level={5} className="nursing-section-title">素材与播放信息</Typography.Title>
          <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 12 }}>
            <Upload
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m3u8,.webm"
              maxCount={1}
              showUploadList={false}
              beforeUpload={(file) => {
                handleVodUpload(file)
                return false
              }}
              disabled={uploading}
            >
              <Button icon={<UploadOutlined />} loading={uploading}>上传视频到 VOD</Button>
            </Upload>
            {uploading ? <Progress percent={uploadPercent} size="small" status={uploadPercent >= 100 ? 'success' : 'active'} /> : null}
            <Typography.Text type="secondary">上传完成后先保存为草稿；确认标题、板块、知识点和播放地址无误后再发布。</Typography.Text>
          </Space>
          <Row gutter={[12, 0]}>
            <Col xs={24} md={12}><Form.Item name="coverUrl" label="封面地址"><Input placeholder="https://.../cover.png" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="assetKey" label="VOD FileId / 素材 Key" tooltip="VOD 上传成功后自动填入 FileId；手动登记时可填素材编号"><Input placeholder="VOD FileId 或素材 Key" suffix={<CopyOutlined onClick={() => copyText(form.getFieldValue('assetKey'))} />} /></Form.Item></Col>
            <Col span={24}><Form.Item name="videoUrl" label="播放地址" tooltip="VOD 上传成功后自动填入；也可填写 COS/CDN/其他可访问 HTTPS 视频链接" rules={[{ validator: async (_, value) => { if (!value || isLikelyPlayableVideoUrl(value)) return; throw new Error('请填写 http/https 开头的视频播放链接') } }]}><Input placeholder="https://.../nursing/vital-signs.mp4" suffix={<LinkOutlined onClick={() => copyText(form.getFieldValue('videoUrl'))} />} /></Form.Item></Col>
          </Row>
          <Divider style={{ margin: '10px 0 12px' }} />
          <Typography.Title level={5} className="nursing-section-title">发布状态</Typography.Title>
          <Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item>
        </Form>
      </Drawer>
      <Modal
        title="视频试播"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        {previewUrl ? (
          <video
            src={previewUrl}
            controls
            autoPlay
            style={{ width: '100%', maxHeight: 420, borderRadius: 8, background: '#000' }}
          />
        ) : (
          <Empty description="无播放地址" />
        )}
      </Modal>
    </SubjectAwarePageContainer>
  )
}
