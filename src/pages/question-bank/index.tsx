import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getLocalQuestionBankOverview, getQuestionBankOverview, isAuthorized } from '@/services/nursing'
import styles from './index.module.scss'

function progressWidth(rate: number) {
  return `${Math.max(0, Math.min(rate, 100))}%`
}

export default function QuestionBankPage() {
  const { data, refetch, isRefetching } = useQuery({
    queryKey: ['questionBank'],
    queryFn: getQuestionBankOverview,
    initialData: getLocalQuestionBankOverview,
  })

  useDidShow(() => {
    refetch()
  })

  usePullDownRefresh(async () => {
    await refetch()
    Taro.stopPullDownRefresh()
  })

  useEffect(() => {
    if (!isRefetching) {
      Taro.stopPullDownRefresh()
    }
  }, [isRefetching])

  function goActivate() {
    Taro.navigateTo({ url: '/pages/activate/index' })
  }

  function goChapter(moduleCode?: string, moduleName?: string) {
    if (!isAuthorized(data.authorization)) {
      goActivate()
      return
    }
    if (!moduleCode) {
      Taro.showToast({ title: '模块信息缺失', icon: 'none' })
      return
    }
    Taro.navigateTo({
      url: `/pages/question-bank-module/index?moduleCode=${moduleCode}&moduleName=${encodeURIComponent(moduleName || moduleCode)}`,
    })
  }

  const authorized = isAuthorized(data.authorization)

  return (
    <View className={styles.page}>
      <View className={styles.topBar}>
        <View className={styles.navSpacer} />
        <Text className={styles.title}>题库目录</Text>
        <View className={styles.navSpacer} />
      </View>

      {!authorized && (
        <View className={styles.activateBanner}>
          <Text className={styles.bannerText}>未激活：仅展示课程框架，输入通行码后解锁题目与解析</Text>
          <View className={styles.activateButton} onTap={goActivate}>
            <Text className={styles.activateButtonText}>立即激活</Text>
          </View>
        </View>
      )}

      <View className={styles.list}>
        {data.catalog.map((item) => (
          <View key={item.moduleCode || item.chapter} className={styles.catalogCard} onTap={() => goChapter(item.moduleCode, item.moduleName || item.chapter)}>
            <View className={styles.cardHeader}>
              <View className={styles.iconBox}>
                <Text className={styles.iconText}>{item.iconText}</Text>
              </View>
              <Text className={styles.chapterTitle}>{item.moduleName || item.chapter}</Text>
              <Text className={authorized ? styles.arrow : styles.lockText}>{authorized ? '>' : '锁定'}</Text>
            </View>
            <View className={styles.metaRow}>
              <Text className={styles.metaText}>{authorized ? `题量 ${item.totalQuestions} 题` : `小章节 ${item.subChapterCount || 0} 个`}</Text>
              <Text className={`${styles.difficultyTag} ${item.difficultyLabel === '较难' ? styles.hardTag : ''}`}>难度 {item.difficultyLabel}</Text>
            </View>
            <View className={styles.progressRow}>
              <Text className={styles.progressLabel}>
                {authorized ? `已完成 ${item.completedQuestions} 题（${item.completionRate}%） · 小章节 ${item.subChapterCount || 0}` : '激活后查看章节题目、答案解析和练习进度'}
              </Text>
              <View className={styles.progressTrack}>
                <View className={styles.progressFill} style={{ width: progressWidth(authorized ? item.completionRate : 0) }} />
              </View>
            </View>
          </View>
        ))}
      </View>

      {!authorized && (
        <View className={styles.bottomPrompt}>
          <Text className={styles.bottomText}>输入学习通行码，解锁全部章节与解析</Text>
          <View className={styles.bottomButton} onTap={goActivate}>
            <Text className={styles.bottomButtonText}>立即激活</Text>
          </View>
        </View>
      )}
    </View>
  )
}
