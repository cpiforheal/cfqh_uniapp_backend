import { PropsWithChildren, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IS_WEAPP } from '@/config/env'
import { getLicenseStatus } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
import './app.scss'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    if (IS_WEAPP && Taro.cloud) {
      Taro.cloud.init({ traceUser: true })
    }

    const store = useAuthStore.getState()
    store.hydrate()

    getLicenseStatus()
      .then((result) => {
        const current = useAuthStore.getState()
        if (result?.authorized) {
          const code = result.authorization?.licenseToken?.code || current.tokenCode
          if (code) current.setAuthorized(code, result.authorization?.expiresAt)
          return
        }
        if (current.status === 'authorized' && result?.reason === 'expired') {
          current.logout()
          Taro.reLaunch({ url: '/pages/activate/index' })
        }
      })
      .catch(() => {
        // 弱网保留本地持久化状态
      })
  }, [])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export default App
