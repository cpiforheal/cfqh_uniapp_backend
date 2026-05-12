import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { getLearningReport, type LearningReportData } from '@/services/nursing'
import { cx } from '@/utils/classNames'
import styles from './index.module.scss'

export default function LearningReportPage() {
  const [data, setData] = useState<LearningReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLearningReport('7d').then((result) => {
      setData(result)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <View className={styles.page}>
        <View className={styles.loadingCard}><Text className={styles.loadingText}>正在生成学习诊断...</Text></View>
      </View>
    )
  }

  if (!data) {
    return (
      <View className={styles.page}>
        <View className={styles.loadingCard}><Text className={styles.loadingText}>暂无学习数据，开始做题后生成报告</Text></View>
      </View>
    )
  }

  const { summary, trend, moduleProgress, weakChapters, reviewCount, recommendation, recommendAction } = data
  const maxTrendCount = Math.max(...trend.map((t) => t.count), 1)

  function handleAction() {
    if (recommendAction === 'review') {
      Taro.navigateTo({ url: '/pages/question-bank-module/index?moduleCode=all&moduleName=%E9%94%99%E9%A2%98%E5%A4%8D%E5%88%B7' })
    } else if (recommendAction === 'weak_chapter') {
      Taro.switchTab({ url: '/pages/question-bank/index' })
    } else {
      Taro.switchTab({ url: '/pages/practice/index' })
    }
  }

  return (
    <View className={styles.page}>
      <Text className={styles.pageTitle}>本周学习诊断</Text>

      <View className={styles.summaryGrid}>
        <View className={styles.summaryItem}>
          <Text className={styles.summaryValue}>{summary.totalPractice}</Text>
          <Text className={styles.summaryLabel}>累计做题</Text>
        </View>
        <View className={styles.summaryItem}>
          <Text className={styles.summaryValue}>{summary.correctRate}%</Text>
          <Text className={styles.summaryLabel}>正确率</Text>
        </View>
        <View className={styles.summaryItem}>
          <Text className={styles.summaryValue}>{summary.practiceDays}</Text>
          <Text className={styles.summaryLabel}>练习天数</Text>
        </View>
        <View className={styles.summaryItem}>
          <Text className={styles.summaryValue}>{summary.weeklyCount}</Text>
          <Text className={styles.summaryLabel}>本周做题</Text>
        </View>
      </View>
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>近 7 天趋势</Text>
        <View className={styles.trendChart}>
          {trend.map((t) => (
            <View key={t.date} className={styles.trendBar}>
              <Text className={styles.trendRate}>{t.count > 0 ? `${t.correctRate}%` : ''}</Text>
              <View className={styles.trendFill} style={{ height: `${Math.max(8, (t.count / maxTrendCount) * 100)}%` }} />
              <Text className={styles.trendDate}>{t.date.slice(5)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>模块掌握度</Text>
        {moduleProgress.map((m) => (
          <View key={m.moduleCode} className={styles.moduleRow}>
            <Text className={styles.moduleName}>{m.moduleName}</Text>
            <View className={styles.moduleBar}>
              <View className={styles.moduleBarFill} style={{ width: `${m.completionRate}%` }} />
            </View>
            <Text className={styles.moduleStats}>{m.doneQuestions}/{m.totalQuestions} · {m.correctRate}%</Text>
          </View>
        ))}
      </View>

      {weakChapters.length > 0 && (
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>薄弱章节 Top 3</Text>
          {weakChapters.map((ch, idx) => (
            <View key={ch.chapter} className={styles.weakRow}>
              <Text className={styles.weakIcon}>⚡</Text>
              <View className={styles.weakInfo}>
                <Text className={styles.weakChapter}>{ch.chapter}</Text>
                <Text className={styles.weakMeta}>{ch.moduleName}</Text>
              </View>
              <Text className={styles.weakCount}>错 {ch.count} 题</Text>
            </View>
          ))}
        </View>
      )}

      <View className={styles.actionCard} onTap={handleAction}>
        <Text className={styles.actionText}>{recommendation}</Text>
        <Text className={styles.actionBtn}>去执行 →</Text>
      </View>
    </View>
  )
}
