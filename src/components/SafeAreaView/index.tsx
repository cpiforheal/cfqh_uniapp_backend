import { View } from '@tarojs/components'
import type { PropsWithChildren } from 'react'

export function SafeAreaView({ children }: PropsWithChildren) {
  return <View>{children}</View>
}
