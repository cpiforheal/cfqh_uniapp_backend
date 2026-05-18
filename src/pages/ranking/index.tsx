import { Image, Text, View } from '@tarojs/components'
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
  avatarUrl?: string
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

  useDidShow(() => { loadRanking() })
  useEffect(() => { loadRanking() }, [tab, loadRanking])

  const tabs: { key: RankTab; label: string }[] = [
    { key: 'days', label: '坚持天数' },
    { key: 'count', label: '刷题总数' },
    { key: 'rate', label: '正确率' },
  ]

  function formatValue(value: number) {
    if (tab === 'rate') return `${value}%`
    if (tab === 'days') return `${value} 天`
    return `${value} 题`
  }

  function getAvatarText(name: string) {
    return (name || '同').slice(0, 1)
  }

  const top3 = list.slice(0, 3)
  const rest = list.slice(3)
  const podiumOrder = [top3[1], top3[0], top3[2]]

  return (
    <View className={styles.page}>
      <View className={styles.tabRow}>
        {tabs.map((t) => (
          <View key={t.key} className={cx(styles.tab, tab === t.key && styles.tabActive)} onTap={() => setTab(t.key)}>
            <Text className={cx(styles.tabText, tab === t.key && styles.tabTextActive)}>{t.label}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View className={styles.emptyCard}><Text className={styles.emptyText}>加载中...</Text></View>
      ) : list.length === 0 ? (
        <View className={styles.emptyCard}><Text className={styles.emptyText}>暂无排行数据</Text></View>
      ) : (
        <>
          {/* 领奖台 */}
          <View className={styles.podium}>
            {podiumOrder.map((item, idx) => {
              if (!item) return <View key={idx} className={styles.podiumSlot} />
              const rank = idx === 0 ? 2 : idx === 1 ? 1 : 3
              const heightClass = rank === 1 ? styles.podiumFirst : rank === 2 ? styles.podiumSecond : styles.podiumThird
              const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
              return (
                <View key={item.openId} className={cx(styles.podiumSlot, heightClass)}>
                  <View className={styles.podiumAvatar}>
                    {item.avatarUrl ? (
                      <Image className={styles.avatarImg} src={item.avatarUrl} mode="aspectFill" />
                    ) : (
                      <Text className={styles.avatarFallback}>{getAvatarText(item.nickname)}</Text>
                    )}
                    <Text className={styles.podiumMedal}>{medal}</Text>
                  </View>
                  <Text className={styles.podiumName}>{item.nickname || '医护同学'}</Text>
                  <Text className={styles.podiumValue}>{formatValue(item.value)}</Text>
                  <View className={cx(styles.podiumBar, heightClass)} />
                </View>
              )
            })}
          </View>

          {/* 4名之后列表 */}
          {rest.length > 0 && (
            <View className={styles.listCard}>
              {rest.map((item, index) => (
                <View className={styles.rankItem} key={item.openId}>
                  <Text className={styles.rankIndex}>{index + 4}</Text>
                  <View className={styles.rankAvatar}>
                    {item.avatarUrl ? (
                      <Image className={styles.avatarImgSmall} src={item.avatarUrl} mode="aspectFill" />
                    ) : (
                      <Text className={styles.avatarFallbackSmall}>{getAvatarText(item.nickname)}</Text>
                    )}
                  </View>
                  <View className={styles.rankInfo}>
                    <Text className={styles.rankName}>{item.nickname || '医护同学'}</Text>
                  </View>
                  <Text className={styles.rankValue}>{formatValue(item.value)}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {myRank && (
        <View className={styles.myRankBar}>
          <Text className={styles.myRankText}>
            🏃 你排名第 {myRank.rank}，{tab === 'rate' ? `正确率 ${myRank.value}%` : tab === 'days' ? `坚持 ${myRank.value} 天` : `刷了 ${myRank.value} 题`}
          </Text>
        </View>
      )}
    </View>
  )
}
