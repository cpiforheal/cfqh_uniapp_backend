import { SaveOutlined } from '@ant-design/icons'
import { ProCard } from '@ant-design/pro-components'
import { Alert, Button, Col, Form, Input, InputNumber, Row, Space, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { SubjectAwarePageContainer } from '@/components/SubjectAwarePageContainer'
import { adminFetch } from '@/services/adminApi'

interface HomeConfigData {
  notice: string
  dailyQuote: string
  examCountdown: number
  aboutText: string
}

export default function HomeConfigPage() {
  const [form] = Form.useForm<HomeConfigData>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    adminFetch<HomeConfigData>('/admin/home-config')
      .then((data) => {
        form.setFieldsValue(data)
      })
      .catch(() => {
        message.warning('首页配置加载失败，将使用默认值')
      })
      .finally(() => setLoading(false))
  }, [form])

  async function handleSave() {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await adminFetch('/admin/home-config', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      message.success('首页配置已保存，小程序端下次刷新生效')
    } catch (error) {
      message.error('保存失败，请检查后端服务')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SubjectAwarePageContainer title="首页展示管理" content="配置小程序首页的通知条、每日语录、考试倒计时和关于信息。修改后学生下次打开小程序即生效。" showGuardrail={false}>
      <Alert
        showIcon
        type="info"
        message="热更新说明"
        description={'通知条为空时首页显示默认标题「今日练习」；每日语录为空时使用内置随机语录；倒计时为 0 时不显示。'}
        style={{ marginBottom: 16 }}
      />

      <ProCard loading={loading}>
        <Form form={form} layout="vertical" initialValues={{ notice: '', dailyQuote: '', examCountdown: 45, aboutText: '' }}>
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item name="notice" label="通知条（首页顶部横幅）" tooltip="显示在首页标题位置，支持公告、提醒等。为空时显示默认标题。" extra="例如：小程序刷题顺序简介！/ 本周五模拟考试，请提前复习。">
                <Input.TextArea rows={2} maxLength={100} showCount placeholder='留空则显示默认标题「今日练习」' />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="dailyQuote" label="每日语录" tooltip="首页通知条下方的激励文字。为空时使用内置随机语录。" extra="例如：护理的本质是关怀，学习的本质是重复。">
                <Input.TextArea rows={2} maxLength={80} showCount placeholder="留空则使用内置随机语录" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="examCountdown" label="考试倒计时（天）" tooltip="首页三胶囊中的倒计时天数。设为 0 则不显示倒计时。">
                <InputNumber min={0} max={365} style={{ width: '100%' }} placeholder="45" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="aboutText" label="关于信息" tooltip={'显示在「我的」页底部或关于页面。'} extra="例如：本小程序仅提供学习辅助，不提供报名或购买服务。">
                <Input.TextArea rows={3} maxLength={200} showCount placeholder="关于本小程序的说明文字" />
              </Form.Item>
            </Col>
          </Row>

          <Space>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>保存配置</Button>
            <Typography.Text type="secondary">保存后学生端下次刷新即生效，无需重新发布小程序</Typography.Text>
          </Space>
        </Form>
      </ProCard>
    </SubjectAwarePageContainer>
  )
}
