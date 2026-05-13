import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Form, Input, Typography, message } from 'antd'
import { useState } from 'react'
import { describeAdminFetchError } from '@/services/adminApi'
import { loginAdmin } from '@/services/adminAuth'
import './login.less'

type FocusState = 'idle' | 'username' | 'password'

function getLoginErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const match = error.message.match(/^后台接口请求失败：HTTP\s+401\s+(.*)$/)
    const detail = match?.[1]?.trim()
    if (detail) {
      try {
        const parsed = JSON.parse(detail) as { message?: unknown }
        if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message.trim()
      } catch {
        if (detail) return detail
      }
    }
  }
  return describeAdminFetchError(error, '后台登录失败')
}

export default function LoginPage() {
  const [focusState, setFocusState] = useState<FocusState>('idle')
  const [loading, setLoading] = useState(false)

  async function handleFinish(values: { username: string; password: string }) {
    setLoading(true)
    try {
      await loginAdmin(values)
      message.success('登录成功')
      window.location.replace('/subjects')
    } catch (error) {
      console.warn('admin login failed', error)
      message.error(getLoginErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const sceneClass = `login-scene ${focusState === 'username' ? 'is-typing' : ''} ${focusState === 'password' ? 'is-secret' : ''}`

  return (
    <div className="login-split">
      <div className="login-split__left">
        <div className="login-left-content">
          <img src="/logo.jpg" alt="乘帆启航" className="login-logo" />
          <h2 className="login-brand">授权信息管理平台</h2>
          <p className="login-brand-en">Sailing Education</p>
        </div>
        <div className={sceneClass}>
          <div className="login-ocean">
            <div className="login-wave login-wave--1" />
            <div className="login-wave login-wave--2" />
            <div className="login-wave login-wave--3" />
          </div>
          <div className="login-sailboat">
            <div className="sailboat__flag" />
            <div className="sailboat__mast" />
            <div className="sailboat__sail sailboat__sail--main" />
            <div className="sailboat__sail sailboat__sail--front" />
            <div className="sailboat__hull" />
            <div className="sailboat__window sailboat__window--1" />
            <div className="sailboat__window sailboat__window--2" />
            <div className="sailboat__wake" />
          </div>
          <div className="login-lighthouse">
            <div className="lighthouse__tower" />
            <div className="lighthouse__top" />
            <div className="lighthouse__light" />
          </div>
        </div>
      </div>

      <div className="login-split__right">
        <div className="login-form-wrapper">
          <Typography.Title level={3} className="login-form-title">后台登录</Typography.Title>
          <Typography.Paragraph type="secondary" className="login-form-subtitle">
            维护题库、授权码和学生数据
          </Typography.Paragraph>
          <Form layout="vertical" initialValues={{ username: 'admin' }} onFinish={handleFinish}>
            <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
              <Input
                autoFocus
                prefix={<UserOutlined />}
                placeholder="admin"
                size="large"
                onFocus={() => setFocusState('username')}
                onBlur={() => setFocusState('idle')}
              />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入密码"
                size="large"
                onFocus={() => setFocusState('password')}
                onBlur={() => setFocusState('idle')}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              登录
            </Button>
          </Form>
        </div>
      </div>
    </div>
  )
}
