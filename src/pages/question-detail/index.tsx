import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { addFavorite, getQuestionDetail, isAuthorized, submitPracticeRecord } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
import styles from './index.module.scss'

type ReviewTabKey = 'analysis' | 'case' | 'confusing' | 'memory' | 'video'

export default function QuestionDetailPage() {
  const router = Taro.useRouter()
  const questionId = router.params.id || 'q-001'
  const [selected, setSelected] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeReviewTab, setActiveReviewTab] = useState<ReviewTabKey>('analysis')

  const authStatus = useAuthStore((state) => state.status)
  const authorized = isAuthorized(authStatus)

  const { data, isError, isLoading } = useQuery({
    queryKey: ['questionDetail', questionId],
    queryFn: () => getQuestionDetail(questionId),
    enabled: authorized,
  })

  useEffect(() => {
    setSelected('')
    setSubmitted(false)
    setFavorited(false)
    setSubmitting(false)
    setActiveReviewTab('analysis')
  }, [questionId])

  async function handleSubmit() {
    if (!data) return
    if (!selected) {
      Taro.showToast({ title: '请选择答案', icon: 'none' })
      return
    }
    if (submitting) return
    setSubmitting(true)
    const result = await submitPracticeRecord(data.id, selected === data.answer, selected, data.progress)
    setSubmitting(false)
    if (!result) {
      Taro.showToast({ title: '提交失败，请稍后重试', icon: 'none' })
      return
    }
    setSubmitted(true)
  }

  async function handleFavorite() {
    if (!data) return
    const result = await addFavorite(data.id)
    if (!result) {
      Taro.showToast({ title: '收藏失败，请稍后重试', icon: 'none' })
      return
    }
    setFavorited(true)
    Taro.showToast({ title: '已加入收藏', icon: 'success' })
  }

  function goNext() {
    if (!data) return
    if (!data.nextQuestionId) {
      Taro.showToast({ title: '暂无下一题', icon: 'none' })
      return
    }
    Taro.redirectTo({ url: `/pages/question-detail/index?id=${data.nextQuestionId}` })
  }

  function goActivate() {
    Taro.reLaunch({ url: '/pages/activate/index' })
  }

  if (!authorized) {
    return (
      <View className={styles.page}>
        <View className={styles.lockCard}>
          <View className={styles.lockBadge}>
            <Text className={styles.lockBadgeText}>LOCK</Text>
          </View>
          <Text className={styles.lockTitle}>通行码未激活或已过期</Text>
          <Text className={styles.lockDesc}>本题为授权资源，激活学习通行码后即可查看题干、选项与解析。通行码与当前微信账号绑定。</Text>
          <View className={styles.lockButton} onTap={goActivate}>
            <Text className={styles.lockButtonText}>去激活</Text>
          </View>
        </View>
      </View>
    )
  }

  if (isLoading || !data) {
    return (
      <View className={styles.page}>
        <View className={styles.lockCard}>
          <Text className={styles.lockTitle}>{isError ? '题目加载失败' : '题目加载中'}</Text>
          <Text className={styles.lockDesc}>{isError ? '请确认通行码仍有效，或稍后下拉重试。' : '正在读取授权题目内容。'}</Text>
        </View>
      </View>
    )
  }

  const progressPercent = data.progress.total > 0 ? Math.round((data.progress.current / data.progress.total) * 100) : 0
  const isCorrect = selected === data.answer
  const reviewTabs = [
    { key: 'analysis' as const, label: '解析', visible: true },
    { key: 'case' as const, label: '案例', visible: Boolean(data.caseMaterial) },
    { key: 'confusing' as const, label: '易混点', visible: Boolean(data.confusingPoint) },
    { key: 'memory' as const, label: '记忆', visible: Boolean(data.memoryTip) },
    { key: 'video' as const, label: '视频', visible: Boolean(data.relatedVideo) },
  ].filter((item) => item.visible)
  const currentReviewTab = reviewTabs.some((item) => item.key === activeReviewTab) ? activeReviewTab : 'analysis'

  return (
    <View className={styles.page}>
      <View className={styles.progressHeader}>
        <Text className={styles.progressLabel}>第 {data.progress.current} / {data.progress.total} 题</Text>
        <View className={styles.progressTrack}>
          <View className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </View>
      </View>

      <View className={styles.questionCard}>
        <View className={styles.tagRow}>
          <Text className={styles.typeTag}>单选题</Text>
          <Text className={styles.levelText}>难度：{data.difficultyText}</Text>
        </View>
        <Text className={styles.questionTitle}>{data.title}</Text>
        <View className={styles.options}>
          {data.options.map((option) => {
            const active = selected === option.key
            const correct = submitted && option.key === data.answer
            const wrong = submitted && active && option.key !== data.answer
            return (
              <View key={option.key} className={`${styles.option} ${active ? styles.optionActive : ''} ${correct ? styles.optionCorrect : ''} ${wrong ? styles.optionWrong : ''}`} onTap={() => !submitted && setSelected(option.key)}>
                <Text className={styles.optionKey}>{option.key}</Text>
                <Text className={styles.optionText}>{option.content}</Text>
                {correct && <Text className={styles.optionStatus}>正确</Text>}
                {wrong && <Text className={styles.optionStatus}>错误</Text>}
              </View>
            )
          })}
        </View>
      </View>

      {submitted && (
        <View className={styles.answerPanel}>
          <View className={styles.answerCol}>
            <Text className={styles.answerLabel}>已提交答案</Text>
            <Text className={styles.answerValue}>{selected}</Text>
          </View>
          <View className={styles.answerCol}>
            <Text className={styles.answerLabel}>你的答案</Text>
            <Text className={`${styles.answerValue} ${isCorrect ? styles.correctColor : styles.wrongColor}`}>{selected}</Text>
          </View>
          <View className={styles.answerCol}>
            <Text className={styles.answerLabel}>正确答案</Text>
            <Text className={styles.correctColor}>{data.answer}</Text>
          </View>
        </View>
      )}

      {submitted && (
        <View className={styles.reviewCard}>
          <View className={styles.reviewTabs}>
            {reviewTabs.map((item) => (
              <View
                key={item.key}
                className={`${styles.reviewTab} ${currentReviewTab === item.key ? styles.reviewTabActive : ''}`}
                onTap={() => setActiveReviewTab(item.key)}
              >
                <Text className={styles.reviewTabText}>{item.label}</Text>
              </View>
            ))}
          </View>

          {currentReviewTab === 'analysis' && <Text className={styles.reviewBody}>{data.analysis}</Text>}
          {currentReviewTab === 'case' && data.caseMaterial && (
            <View className={styles.reviewBlock}>
              <Text className={styles.reviewBlockTitle}>{data.caseMaterial.title}</Text>
              <Text className={styles.reviewBody}>{data.caseMaterial.background}</Text>
            </View>
          )}
          {currentReviewTab === 'confusing' && data.confusingPoint && (
            <View className={styles.reviewBlock}>
              <Text className={styles.reviewBlockTitle}>{data.confusingPoint.title}</Text>
              <Text className={styles.reviewBody}>{data.confusingPoint.contrastSummary}</Text>
            </View>
          )}
          {currentReviewTab === 'memory' && data.memoryTip && (
            <View className={styles.reviewBlock}>
              <Text className={styles.reviewBlockTitle}>{data.memoryTip.title}</Text>
              <Text className={styles.reviewBody}>{data.memoryTip.tip}</Text>
            </View>
          )}
          {currentReviewTab === 'video' && data.relatedVideo && (
            <View className={styles.reviewBlock}>
              <Text className={styles.reviewBlockTitle}>{data.relatedVideo.title}</Text>
              <Text className={styles.reviewBody}>公开讲解已关联到本题，可在视频页继续查看。</Text>
            </View>
          )}
        </View>
      )}

      <View className={styles.bottomBar}>
        {!submitted ? (
          <>
            <View className={styles.secondaryButtonDisabled}>下一题</View>
            <View className={styles.submitButton} onTap={handleSubmit}>{submitting ? '提交中...' : '提交答案'}</View>
          </>
        ) : (
          <>
            <View className={styles.secondaryButton} onTap={handleFavorite}>{favorited || data.isFavorite ? '已收藏' : '加入收藏'}</View>
            <View className={styles.nextButton} onTap={goNext}>下一题</View>
          </>
        )}
      </View>
    </View>
  )
}
