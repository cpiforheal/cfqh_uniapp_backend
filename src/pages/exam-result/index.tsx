import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { getExamResult } from '../../services/nursing'
import type { ExamResultInfo } from '../../services/nursing'
import styles from './index.module.scss'

export default function ExamResultPage() {
  const router = useRouter()
  const sessionId = router.params.sessionId || ''
  const [result, setResult] = useState<ExamResultInfo | null>(null)

  useEffect(() => {
    if (sessionId) loadResult()
  }, [sessionId])

  async function loadResult() {
    try {
      const data = await getExamResult(sessionId)
      setResult(data)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
  }

  if (!result) return null

  if (!result.published) {
    return (
      <View className={styles.resultPage}>
        <View className={styles.pendingCard}>
          <Text className={styles.pendingIcon}>⏳</Text>
          <Text className={styles.pendingText}>老师正在批改中，请稍后查看</Text>
        </View>
      </View>
    )
  }

  return (
    <View className={styles.resultPage}>
      <View className={styles.scoreCard}>
        <Text className={styles.examTitle}>{result.examTitle}</Text>
        <Text className={styles.totalScore}>{result.totalScore ?? 0}</Text>
        <Text className={styles.scoreUnit}>分</Text>
        <View className={styles.scoreBreakdown}>
          <View className={styles.breakdownItem}>
            <Text className={styles.breakdownLabel}>客观题</Text>
            <Text className={styles.breakdownValue}>{result.objectiveScore ?? 0}</Text>
          </View>
          <View className={styles.breakdownItem}>
            <Text className={styles.breakdownLabel}>主观题</Text>
            <Text className={styles.breakdownValue}>{result.subjectiveScore ?? 0}</Text>
          </View>
        </View>
      </View>

      <View className={styles.rankCard}>
        <Text className={styles.rankLabel}>我的排名</Text>
        <Text className={styles.rankValue}>
          第 {result.rank ?? '-'} 名 / 共 {result.totalStudents ?? 0} 人
        </Text>
      </View>

      {result.comment && (
        <View className={styles.commentCard}>
          <Text className={styles.commentTitle}>老师评语</Text>
          <Text className={styles.commentContent}>{result.comment}</Text>
        </View>
      )}

      {result.answers && result.answers.length > 0 && (
        <View className={styles.analysisSection}>
          <Text className={styles.analysisTitle}>答题分析</Text>
          {result.answers.map((a) => (
            <View key={a.questionId} className={styles.answerItem}>
              <View className={styles.answerHeader}>
                <Text className={styles.answerSeq}>第 {a.seq} 题（{a.score ?? 0}/{a.maxScore}分）</Text>
                {a.isCorrect !== null && (
                  <Text className={a.isCorrect ? styles.answerCorrect : styles.answerWrong}>
                    {a.isCorrect ? '正确' : '错误'}
                  </Text>
                )}
              </View>
              <Text className={styles.answerStem}>{a.stem}</Text>
              <Text className={styles.answerDetail}>
                你的答案：{a.yourAnswer || '未作答'}　正确答案：{a.correctAnswer}
              </Text>
              {a.analysis && (
                <Text className={styles.analysisText}>解析：{a.analysis}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
