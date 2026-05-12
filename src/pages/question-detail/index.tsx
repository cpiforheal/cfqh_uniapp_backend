import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addFavorite, getLicenseStatus, getQuestionDetail, submitPracticeRecord } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import type { QuestionDetail } from '@/types/study'
import { cx } from '@/utils/classNames'
import styles from './index.module.scss'

type ReviewTabKey = 'analysis' | 'case' | 'confusing' | 'memory' | 'video'

function normalizeAnswer(value: string) {
  return value.split('').sort().join('')
}

function questionTypeText(type?: string) {
  if (type === 'multiple_choice') return '多选题'
  if (type === 'judgment') return '判断题'
  if (type === 'short_answer') return '简答题'
  if (type === 'case_analysis') return '案例分析题'
  return '单选题'
}

export default function QuestionDetailPage() {
  const router = Taro.useRouter()
  const questionId = router.params.id || 'q-001'
  const [selected, setSelected] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeReviewTab, setActiveReviewTab] = useState<ReviewTabKey>('analysis')
  const [authorized, setServerAuthorized] = useState(false)
  const [checkingAuthorization, setCheckingAuthorization] = useState(true)
  const [data, setData] = useState<QuestionDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)

  const setAuthorized = useAuthStore((state) => state.setAuthorized)
  const { settings, hydrate: hydrateSettings } = useSettingsStore()
  useEffect(() => { hydrateSettings() }, [hydrateSettings])

  const [timer, setTimer] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const loadQuestionDetail = useCallback(async () => {
    setCheckingAuthorization(true)
    setIsLoading(true)
    setIsError(false)
    try {
      const status = await getLicenseStatus()
      setServerAuthorized(Boolean(status.authorized))
      setCheckingAuthorization(false)
      if (!status.authorized) {
        setData(null)
        return
      }

      const tokenCode = status.authorization?.licenseToken?.code
      if (tokenCode) setAuthorized(tokenCode, status.authorization?.expiresAt)
      setData(await getQuestionDetail(questionId))
    } catch (error) {
      console.warn('question detail load failed', error)
      setIsError(true)
      setData(null)
      setCheckingAuthorization(false)
    } finally {
      setIsLoading(false)
    }
  }, [questionId, setAuthorized])

  useEffect(() => {
    setSelected('')
    setSubmitted(false)
    setFavorited(false)
    setSubmitting(false)
    setActiveReviewTab('analysis')
    loadQuestionDetail()
  }, [questionId])

  useDidShow(() => {
    loadQuestionDetail()
  })

  useEffect(() => {
    if (!data || submitted) return
    startTimeRef.current = Date.now()
    if (settings.timerEnabled) {
      setTimer(settings.timerSeconds)
      timerRef.current = setInterval(() => {
        setTimer((t) => {
          if (t <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            return 0
          }
          return t - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [data?.id, submitted])

  const displayOptions = useMemo(() => {
    if (!data?.options) return []
    if (!settings.shuffleOptions) return data.options
    const shuffled = [...data.options]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }, [data?.id, settings.shuffleOptions])

  function handleOptionTap(key: string) {
    if (!data || submitted) return
    if (data.type !== 'multiple_choice') {
      setSelected(key)
      return
    }
    setSelected((current) => {
      const keys = new Set(current.split('').filter(Boolean))
      if (keys.has(key)) keys.delete(key)
      else keys.add(key)
      return Array.from(keys).sort().join('')
    })
  }

  async function handleSubmit() {
    if (!data) return
    if (!selected) {
      Taro.showToast({ title: '请选择答案', icon: 'none' })
      return
    }
    if (submitting) return
    setSubmitting(true)
    if (timerRef.current) clearInterval(timerRef.current)
    const durationMs = startTimeRef.current ? Date.now() - startTimeRef.current : undefined
    const isCorrect = normalizeAnswer(selected) === normalizeAnswer(data.answer)
    const result = await submitPracticeRecord(data.id, isCorrect, selected, data.progress, { durationMs, selectedOption: selected, reviewFrequency: settings.reviewFrequency })
    setSubmitting(false)
    if (!result) {
      Taro.showToast({ title: '提交失败，请稍后重试', icon: 'none' })
      return
    }
    setSubmitted(true)

    const dailyGoal = settings.dailyGoal || 20
    const todayKey = `cfqh_daily_done_${new Date().toISOString().slice(0, 10)}`
    const todayDone = (Number(Taro.getStorageSync(todayKey)) || 0) + 1
    Taro.setStorageSync(todayKey, String(todayDone))
    if (todayDone === dailyGoal) {
      setTimeout(() => {
        Taro.showModal({
          title: '今日目标已完成',
          content: `完成 ${todayDone} 题\n继续保持，明天见！`,
          showCancel: false,
          confirmText: '好的',
        })
      }, 500)
    }
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

  if (checkingAuthorization) {
    return (
      <View className={styles.page}>
        <View className={styles.lockCard}>
          <View className={styles.lockBadge}>
            <Text className={styles.lockBadgeText}>CHECK</Text>
          </View>
          <Text className={styles.lockTitle}>正在确认授权</Text>
          <Text className={styles.lockDesc}>正在读取本机缓存和后端授权状态，请稍候。</Text>
        </View>
      </View>
    )
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
          {isError && (
            <View className={styles.lockButton} onTap={loadQuestionDetail}>
              <Text className={styles.lockButtonText}>重新加载</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  const progressPercent = data.progress.total > 0 ? Math.round((data.progress.current / data.progress.total) * 100) : 0
  const isCorrect = normalizeAnswer(selected) === normalizeAnswer(data.answer)
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
          <Text className={styles.typeTag}>{questionTypeText(data.type)}</Text>
          <Text className={styles.levelText}>难度：{data.difficultyText}</Text>
        </View>
        <Text className={styles.questionTitle}>{data.title}</Text>
        {settings.timerEnabled && !submitted && (
          <Text className={styles.levelText} style={{ color: timer <= 10 ? '#f87171' : undefined }}>⏱ {timer}s</Text>
        )}
        <View className={styles.options}>
          {displayOptions.map((option) => {
            const active = data.type === 'multiple_choice' ? selected.includes(option.key) : selected === option.key
            const correct = submitted && data.answer.includes(option.key)
            const wrong = submitted && active && !data.answer.includes(option.key)
            return (
              <View key={option.key} className={cx(styles.option, active && styles.optionActive, correct && styles.optionCorrect, wrong && styles.optionWrong)} onTap={() => handleOptionTap(option.key)}>
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
            <Text className={cx(styles.answerValue, isCorrect ? styles.correctColor : styles.wrongColor)}>{selected}</Text>
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
                className={cx(styles.reviewTab, currentReviewTab === item.key && styles.reviewTabActive)}
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
