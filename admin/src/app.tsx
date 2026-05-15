import type React from 'react'
import { BookOutlined, LogoutOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Button, Space, Tag, Typography } from 'antd'
import { getAdminSessionToken } from '@/services/adminApi'
import { logoutAdmin, queryCurrentAdmin, type AdminUser } from '@/services/adminAuth'

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const target = event.target as HTMLElement
    if (target instanceof HTMLScriptElement && target.src?.includes('.async.js')) {
      window.location.reload()
    }
  }, true)
}

interface InitialState {
  name: string
  currentAdmin?: AdminUser | null
}

interface RuntimeLayoutParams {
  initialState?: InitialState
}

export async function getInitialState(): Promise<InitialState> {
  if (!getAdminSessionToken()) return { name: '医护内容助教', currentAdmin: null }
  try {
    const currentAdmin = await queryCurrentAdmin()
    return { name: currentAdmin.username, currentAdmin }
  } catch {
    return { name: '医护内容助教', currentAdmin: null }
  }
}

export const layout = ({ initialState }: RuntimeLayoutParams) => ({
  title: '医护自学资源后台',
  logo: false,
  avatarProps: {
    title: initialState?.name ?? '内容管理员',
    icon: <UserOutlined />,
    size: 'small' as const,
  },
  menuHeaderRender: (_logo: React.ReactNode, _title: React.ReactNode, props?: { collapsed?: boolean }) => {
    const collapsed = Boolean(props?.collapsed)

    return (
      <Space
        className="nursing-admin-menu-header"
        size={collapsed ? 0 : 8}
        style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
      >
        <Avatar
          className="nursing-admin-menu-header__avatar"
          shape="square"
          size={collapsed ? 30 : 32}
          style={{ background: 'linear-gradient(135deg, #13a8a8 0%, #1677ff 100%)' }}
          icon={<BookOutlined />}
        />
        {!collapsed ? (
          <Space className="nursing-admin-menu-header__text" direction="vertical" size={0}>
            <Typography.Text className="nursing-admin-menu-header__title" strong>医护学习资源</Typography.Text>
            <Typography.Text className="nursing-admin-menu-header__subtitle" type="secondary">内容维护后台</Typography.Text>
          </Space>
        ) : null}
      </Space>
    )
  },
  rightContentRender: () => (
    <Space size={10} className="nursing-admin-right-content">
      <Tag className="nursing-admin-guardrail-tag" color="cyan" icon={<SafetyCertificateOutlined />}>非医疗建议 · 自学辅助</Tag>
      <Typography.Text className="nursing-admin-user-name" type="secondary">{initialState?.currentAdmin?.username ?? initialState?.name ?? '内容管理员'}</Typography.Text>
      <Button
        size="small"
        icon={<LogoutOutlined />}
        onClick={async () => {
          await logoutAdmin()
          window.location.replace('/login')
        }}
      >
        退出
      </Button>
    </Space>
  ),
  onPageChange: () => {
    const pathname = window.location.pathname
    if (pathname !== '/login' && !initialState?.currentAdmin) {
      window.location.replace('/login')
    }
  },
  pageTitleRender: (_props: unknown, _defaultPageTitle: string, info: { title?: string }) => {
    return info?.title ? `${info.title} - 医护自学资源后台` : '医护自学资源后台'
  },
  waterMarkProps: {
    content: '医护自学资源后台',
    fontColor: 'rgba(19, 168, 168, 0.045)',
    gapX: 120,
    gapY: 96,
    fontSize: 15,
  },
})
