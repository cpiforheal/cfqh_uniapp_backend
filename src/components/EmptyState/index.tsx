import { View } from '@tarojs/components'
import type { PropsWithChildren } from 'react'

export function EmptyState({ children }: PropsWithChildren) {
  return <View>{children}</View>
}
