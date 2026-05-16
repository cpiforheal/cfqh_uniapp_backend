import { useState, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { getExamResult, getExamLeaderboard } from '../../services/nursing'
import type { ExamResultInfo, LeaderboardEntry } from '../../services/nursing'
import styles from './index.module.scss'

export default function ExamResultPage() {
  const router = useRouter()
  const sessionId = router.params.sessionId || ''
  const [result, setResult] = useState<ExamResultInfo | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    if (sessionId) loadResult()
  }, [sessionId])

  async function loadResult() {
    try {
      const [data, lb] = await Promise.all([
        getExamResult(sessionId),
        getExamLeaderboard(sessionId).catch(() => ({ published: false, leaderboard: [] })),
      ])
      setResult(data)
      if (lb.published) setLeaderboard(lb.leaderboard)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
  }

  if (!result) {
    return (
      <View className={styles.resultPage}>
        <View className={styles.pendingCard}>
          <Text className={styles.pendingText}>成绩加载中...</Text>
        </View>
      </View>
    )
  }

  const hasScore = result.totalScore !== undefined && result.totalScore !== null

  if (!result.published && !hasScore) {
    return (
      <View className={styles.resultPage}>
        <View className={styles.pendingCard}>
          <Text className={styles.pendingIcon}>⏳</Text>
          <Text className={styles.pendingTitle}>{result.examTitle}</Text>
          <Text className={styles.pendingText}>
            {result.status === 'in_progress' ? '考试仍在进行中，请先完成交卷' : '老师正在批改中，请稍后查看'}
          </Text>
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

      {!result.published && (
        <View className={styles.noticeCard}>
          <Text className={styles.noticeText}>成绩已批改，排名和答题解析将在老师发布后显示</Text>
        </View>
      )}

      {result.published && (
        <View className={styles.rankCard}>
          <Text className={styles.rankLabel}>我的排名</Text>
          <Text className={styles.rankValue}>
            第 {result.rank ?? '-'} 名 / 共 {result.totalStudents ?? 0} 人
          </Text>
        </View>
      )}

      {leaderboard.length > 0 && (
        <View className={styles.leaderboardSection}>
          <Text className={styles.leaderboardTitle}>考试排行榜</Text>
          <View className={styles.podium}>
            {leaderboard.length >= 2 && (
              <View className={`${styles.podiumItem} ${styles.podiumSecond}`}>
                <View className={styles.podiumAvatar}>
                  {leaderboard[1].avatarUrl ? (
                    <Image className={styles.podiumAvatarImg} src={leaderboard[1].avatarUrl} mode="aspectFill" />
                  ) : (
                    <Text className={styles.podiumAvatarText}>2</Text>
                  )}
                </View>
                <Text className={styles.podiumName}>{leaderboard[1].nickname}</Text>
                <Text className={styles.podiumScore}>{leaderboard[1].totalScore}分</Text>
                <View className={`${styles.podiumBar} ${styles.podiumBarSecond}`}>
                  <Text className={styles.podiumRankText}>2</Text>
                </View>
              </View>
            )}
            {leaderboard.length >= 1 && (
              <View className={`${styles.podiumItem} ${styles.podiumFirst}`}>
                <Text className={styles.podiumCrown}>👑</Text>
                <View className={styles.podiumAvatar}>
                  {leaderboard[0].avatarUrl ? (
                    <Image className={styles.podiumAvatarImg} src={leaderboard[0].avatarUrl} mode="aspectFill" />
                  ) : (
                    <Text className={styles.podiumAvatarText}>1</Text>
                  )}
                </View>
                <Text className={styles.podiumName}>{leaderboard[0].nickname}</Text>
                <Text className={styles.podiumScore}>{leaderboard[0].totalScore}分</Text>
                <View className={`${styles.podiumBar} ${styles.podiumBarFirst}`}>
                  <Text className={styles.podiumRankText}>1</Text>
                </View>
              </View>
            )}
            {leaderboard.length >= 3 && (
              <View className={`${styles.podiumItem} ${styles.podiumThird}`}>
                <View className={styles.podiumAvatar}>
                  {leaderboard[2].avatarUrl ? (
                    <Image className={styles.podiumAvatarImg} src={leaderboard[2].avatarUrl} mode="aspectFill" />
                  ) : (
                    <Text className={styles.podiumAvatarText}>3</Text>
                  )}
                </View>
                <Text className={styles.podiumName}>{leaderboard[2].nickname}</Text>
                <Text className={styles.podiumScore}>{leaderboard[2].totalScore}分</Text>
                <View className={`${styles.podiumBar} ${styles.podiumBarThird}`}>
                  <Text className={styles.podiumRankText}>3</Text>
                </View>
              </View>
            )}
          </View>
          {leaderboard.slice(3).map((entry) => (
            <View key={entry.rank} className={styles.leaderboardRow}>
              <Text className={styles.leaderboardRank}>{entry.rank}</Text>
              <View className={styles.leaderboardAvatar}>
                {entry.avatarUrl ? (
                  <Image className={styles.leaderboardAvatarImg} src={entry.avatarUrl} mode="aspectFill" />
                ) : (
                  <Text className={styles.leaderboardAvatarText}>{entry.nickname.slice(0, 1)}</Text>
                )}
              </View>
              <View className={styles.leaderboardInfo}>
                <Text className={styles.leaderboardName}>{entry.nickname}</Text>
                <Text className={styles.leaderboardMeta}>
                  {entry.durationText || '-'} · 正确率{entry.correctRate ?? 0}%
                </Text>
              </View>
              <Text className={styles.leaderboardScore}>{entry.totalScore}分</Text>
            </View>
          ))}
        </View>
      )}

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
