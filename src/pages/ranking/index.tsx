import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { getLicenseStatus, getRanking } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
import { cx } from '@/utils/classNames'
import styles from './index.module.scss'

type RankTab = 'days' | 'count' | 'rate'

interface RankItem {
  openId: string
  nickname: string
  value: number
}

export default function RankingPage() {
  const [tab, setTab] = useState<RankTab>('days')
  const [list, setList] = useState<RankItem[]>([])
  const [myRank, setMyRank] = useState<{ rank: number; value: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const setAuthorized = useAuthStore((state) => state.setAuthorized)

  const loadRanking = useCallback(async () => {
    setLoading(true)
    try {
      const status = await getLicenseStatus()
      if (!status?.authorized) {
        Taro.showToast({ title: '请先激活通行码', icon: 'none' })
        Taro.navigateBack()
        return
      }
      const tokenCode = status.authorization?.licenseToken?.code
      if (tokenCode) setAuthorized(tokenCode, status.authorization?.expiresAt)

      const result = await getRanking(tab)
      setList(result.list || [])
      setMyRank(result.me || null)
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }, [tab, setAuthorized])

  useDidShow(() => {
    loadRanking()
  })

  useEffect(() => {
    loadRanking()
  }, [tab, loadRanking])

  const tabs: { key: RankTab; label: string }[] = [
    { key: 'days', label: '坚持天数' },
    { key: 'count', label: '刷题总数' },
    { key: 'rate', label: '正确率' },
  ]

  function medalEmoji(index: number) {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `${index + 1}`
  }

  function formatValue(value: number) {
    if (tab === 'rate') return `${value}%`
    if (tab === 'days') return `${value} 天`
    return `${value} 题`
  }

  return (
    <View className={styles.page}>
      <View className={styles.tabRow}>
        {tabs.map((t) => (
          <View
            key={t.key}
            className={cx(styles.tab, tab === t.key && styles.tabActive)}
            onTap={() => setTab(t.key)}
          >
            <Text className={cx(styles.tabText, tab === t.key && styles.tabTextActive)}>{t.label}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View className={styles.emptyCard}>
          <Text className={styles.emptyText}>加载中...</Text>
        </View>
      ) : list.length === 0 ? (
        <View className={styles.emptyCard}>
          <Text className={styles.emptyText}>暂无排行数据</Text>
        </View>
      ) : (
        <View className={styles.listCard}>
          {list.map((item, index) => (
            <View className={styles.rankItem} key={item.openId}>
              <Text className={cx(styles.rankIndex, index < 3 && styles.rankIndexTop)}>{medalEmoji(index)}</Text>
              <View className={styles.rankInfo}>
                <Text className={styles.rankName}>{item.nickname || '医护同学'}</Text>
              </View>
              <Text className={cx(styles.rankValue, index < 3 && styles.rankValueTop)}>{formatValue(item.value)}</Text>
            </View>
          ))}
        </View>
      )}

      {myRank && (
        <View className={styles.myRankBar}>
          <Text className={styles.myRankText}>
            🏃 你已经坚持了 {myRank.value} 天，排名第 {myRank.rank}，坚持就是胜利！
          </Text>
        </View>
      )}
    </View>
  )
}
