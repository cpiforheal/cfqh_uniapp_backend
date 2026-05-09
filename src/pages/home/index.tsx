import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { getHomeOverview, getLocalHomeOverview } from '@/services/home'
import type { ConfusingPointSummary, NursingKnowledgeCard, KnowledgePointTag } from '@/types/study'
import styles from './index.module.scss'

export default function HomePage() {
  const { data } = useQuery({
    queryKey: ['homeOverview'],
    queryFn: getHomeOverview,
    initialData: getLocalHomeOverview,
  })

  const todayProblem = data?.todayProblem

  function goTodayProblem() {
    if (!todayProblem?.id) return
    Taro.navigateTo({ url: `/pages/question-detail/index?id=${todayProblem.id}` })
  }

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.eyebrow}>{data?.subjectName ?? '自学辅助'}</Text>
        <Text className={styles.title}>今日医护复习任务</Text>
        <Text className={styles.subtitle}>先完成今日练习，再复习知识点卡片和易混点。</Text>
      </View>

      <View className={styles.card} onTap={goTodayProblem}>
        <Text className={styles.cardLabel}>今日练习</Text>
        <Text className={styles.problemTitle}>{data?.todayProblem.title ?? '加载中...'}</Text>
        <Text className={styles.problemStem}>{data?.todayProblem.stem ?? ''}</Text>
        <View className={styles.tags}>
          {data?.todayProblem.knowledgePoints.map((point: KnowledgePointTag) => (
            <Text key={point.id} className={styles.tag}>{point.name}</Text>
          ))}
        </View>
        <View className={styles.metaRow}>
          <Text className={styles.meta}>预计 {data?.todayProblem.estimatedMinutes ?? '-'} 分钟</Text>
          <Text className={styles.meta}>本周已完成 {data?.weeklyCompletedCount ?? 0} 次</Text>
        </View>
        <View className={styles.actionButton}>开始今日练习</View>
      </View>

      <View className={styles.suggestion}>
        <Text className={styles.suggestionTitle}>知识点卡片</Text>
        {data?.knowledgeCards?.map((card: NursingKnowledgeCard) => (
          <View key={card.id} className={styles.knowledgeCard}>
            <Text className={styles.knowledgeTitle}>{card.title}</Text>
            <Text className={styles.suggestionText}>{card.summary}</Text>
            <Text className={styles.memoryTip}>记忆提示：{card.memoryTip}</Text>
          </View>
        ))}
      </View>

      <View className={styles.suggestion}>
        <Text className={styles.suggestionTitle}>易混点提醒</Text>
        {data?.confusingPoints?.map((point: ConfusingPointSummary) => (
          <View key={point.id} className={styles.knowledgeCard}>
            <Text className={styles.knowledgeTitle}>{point.title}</Text>
            <Text className={styles.suggestionText}>{point.contrast}</Text>
          </View>
        ))}
      </View>

      <View className={styles.suggestion}>
        <Text className={styles.suggestionTitle}>学习建议</Text>
        <Text className={styles.suggestionText}>{data?.suggestion ?? '正在生成今日学习建议。'}</Text>
      </View>

      <Text className={styles.disclaimer}>{data?.disclaimer}</Text>
    </View>
  )
}
