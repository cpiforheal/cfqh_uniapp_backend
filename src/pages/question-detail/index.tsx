import { Canvas, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addFavorite, getLicenseStatus, getModuleQuestions, getQuestionDetail, submitPracticeRecord } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import type { QuestionDetail } from '@/types/study'
import { cx } from '@/utils/classNames'
import styles from './index.module.scss'

type ReviewTabKey = 'analysis' | 'case' | 'confusing' | 'memory'
type PracticeMode = 'answer' | 'review'

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
  const questionId = String(router.params.id || '').trim()
  const currentModuleCode = String(router.params.moduleCode || '').trim()
  const [selected, setSelected] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeReviewTab, setActiveReviewTab] = useState<ReviewTabKey>('analysis')
  const hasLocalAuth = (() => { try { const s = Taro.getStorageSync<string>('cfqh_auth_state'); return s ? JSON.parse(s).status === 'authorized' : false } catch { return false } })()
  const [authorized, setServerAuthorized] = useState(hasLocalAuth)
  const [checkingAuthorization, setCheckingAuthorization] = useState(!hasLocalAuth)
  const [data, setData] = useState<QuestionDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [loadErrorText, setLoadErrorText] = useState('请确认通行码仍有效，或稍后下拉重试。')
  const authorizedRef = useRef(hasLocalAuth)

  // 【功能1】背题模式 / 答题模式切换
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('answer')
  // 【功能1】答题卡弹窗
  const [showAnswerSheet, setShowAnswerSheet] = useState(false)
  // 答题卡题目ID列表（用于点击跳转）
  const [sheetQuestionIds, setSheetQuestionIds] = useState<string[]>([])
  // 【功能2】浏览历史栈，支持返回上一题
  const [questionHistory, setQuestionHistory] = useState<string[]>(() => {
    try {
      const raw = Taro.getStorageSync<string>('cfqh_question_history')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  const setAuthorized = useAuthStore((state) => state.setAuthorized)
  const { settings, hydrate: hydrateSettings } = useSettingsStore()
  useEffect(() => { hydrateSettings() }, [hydrateSettings])

  const [timer, setTimer] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const autoNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [feedbackAnim, setFeedbackAnim] = useState<'correct' | 'wrong' | ''>('')
  const [comboCount, setComboCount] = useState<number>(() => {
    try { return Number(Taro.getStorageSync('cfqh_combo') || 0) } catch { return 0 }
  })
  const [comboDisplay, setComboDisplay] = useState<{ level: string; text: string } | null>(null)

  // 【功能4】分享当前题目
  useShareAppMessage(() => {
    if (!data) return { title: '医护刷题', path: '/pages/practice/index' }
    const typeLabel = questionTypeText(data.type)
    return {
      title: `【${typeLabel}】${data.title.slice(0, 40)}`,
      path: `/pages/question-detail/index?id=${data.id}`,
    }
  })

  const checkAuthAndLoad = useCallback(async () => {
    setCheckingAuthorization(true)
    setIsLoading(true)
    setIsError(false)
    setLoadErrorText('请确认通行码仍有效，或稍后下拉重试。')
    try {
      const status = await getLicenseStatus()
      const isAuthed = Boolean(status.authorized)
      setServerAuthorized(isAuthed)
      authorizedRef.current = isAuthed
      setCheckingAuthorization(false)
      if (!isAuthed) {
        setData(null)
        return
      }
      const tokenCode = status.authorization?.licenseToken?.code
      if (tokenCode) setAuthorized(tokenCode, status.authorization?.expiresAt)
      if (!questionId) {
        setIsError(true)
        setLoadErrorText('题目入口缺少有效 ID，请从练习首页或题库重新进入。')
        setData(null)
        return
      }
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

  const loadQuestionOnly = useCallback(async () => {
    if (!questionId) return
    setIsLoading(true)
    setIsError(false)
    try {
      setData(await getQuestionDetail(questionId))
    } catch (error) {
      console.warn('question detail load failed', error)
      authorizedRef.current = false
      await checkAuthAndLoad()
    } finally {
      setIsLoading(false)
    }
  }, [questionId, checkAuthAndLoad])

  const loadQuestionDetail = useCallback(async () => {
    if (authorizedRef.current) {
      await loadQuestionOnly()
    } else {
      await checkAuthAndLoad()
    }
  }, [checkAuthAndLoad, loadQuestionOnly])

  // 【功能7】每次切换题目时完全重置答题状态，确保错题重做不残留红色标记
  useEffect(() => {
    setSelected('')
    setSubmitted(false)
    setFavorited(false)
    setSubmitting(false)
    setActiveReviewTab('analysis')
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current)
      autoNextTimerRef.current = null
    }
    loadQuestionDetail()
  }, [questionId, loadQuestionDetail])

  useDidShow(() => {
    loadQuestionDetail()
  })

  useEffect(() => {
    if (!data || submitted || practiceMode === 'review') return
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
  }, [data?.id, submitted, practiceMode])

  const displayOptions = useMemo(() => {
    if (!data?.options) return []
    if (!settings.shuffleOptions || practiceMode === 'review') return data.options
    const shuffled = [...data.options]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }, [data?.id, settings.shuffleOptions, practiceMode])

  function handleOptionTap(key: string) {
    if (!data || submitted || practiceMode === 'review') return
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
    setFeedbackAnim(isCorrect ? 'correct' : 'wrong')
    setTimeout(() => setFeedbackAnim(''), 1500)

    // combo 评价系统
    if (isCorrect) {
      const newCombo = comboCount + 1
      setComboCount(newCombo)
      try { Taro.setStorageSync('cfqh_combo', String(newCombo)) } catch {}
      const level = newCombo >= 8 ? 'unbelievable' : newCombo >= 5 ? 'amazing' : newCombo >= 3 ? 'excellent' : 'good'
      const text = newCombo >= 8 ? 'Unbelievable!' : newCombo >= 5 ? 'Amazing!' : newCombo >= 3 ? 'Excellent!' : 'Good!'
      setComboDisplay({ level, text })
      setTimeout(() => setComboDisplay(null), 2000)
    } else {
      setComboCount(0)
      try { Taro.setStorageSync('cfqh_combo', '0') } catch {}
      setComboDisplay(null)
    }

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

    // 【功能6】答对自动翻页
    if (isCorrect && settings.autoNext && data.nextQuestionId) {
      autoNextTimerRef.current = setTimeout(() => {
        goNext()
      }, 1200)
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
    // 【功能2】记录历史以支持返回
    const newHistory = [...questionHistory, data.id]
    setQuestionHistory(newHistory)
    try { Taro.setStorageSync('cfqh_question_history', JSON.stringify(newHistory.slice(-50))) } catch {}
    Taro.redirectTo({ url: `/pages/question-detail/index?id=${data.nextQuestionId}${currentModuleCode ? `&moduleCode=${currentModuleCode}` : ''}` })
  }

  // 【功能2】返回上一题
  function goPrev() {
    if (questionHistory.length === 0) {
      Taro.showToast({ title: '没有上一题了', icon: 'none' })
      return
    }
    const prevId = questionHistory[questionHistory.length - 1]
    const newHistory = questionHistory.slice(0, -1)
    setQuestionHistory(newHistory)
    try { Taro.setStorageSync('cfqh_question_history', JSON.stringify(newHistory)) } catch {}
    Taro.redirectTo({ url: `/pages/question-detail/index?id=${prevId}${currentModuleCode ? `&moduleCode=${currentModuleCode}` : ''}` })
  }

  // 【功能4】手动触发分享
  function handleShare() {
    if (!data) return
    Taro.showActionSheet({
      itemList: ['转发给好友', '生成海报保存'],
    }).then((res) => {
      if (res.tapIndex === 0) {
        Taro.showToast({ title: '请点击右上角"..."转发', icon: 'none' })
      } else if (res.tapIndex === 1) {
        generateSharePoster()
      }
    }).catch(() => {})
  }

  async function generateSharePoster() {
    if (!data) return
    Taro.showLoading({ title: '生成中...' })
    try {
      const query = Taro.createSelectorQuery()
      const canvasNode = await new Promise<any>((resolve) => {
        query.select('.sharePosterCanvas').fields({ node: true, size: true }).exec((res) => {
          resolve(res?.[0]?.node || null)
        })
      })
      if (!canvasNode) {
        Taro.hideLoading()
        Taro.showToast({ title: '画布初始化失败', icon: 'none' })
        return
      }
      const sysInfo = Taro.getSystemInfoSync()
      const dpr = sysInfo.pixelRatio || 2
      const width = 600
      const height = 800
      canvasNode.width = width * dpr
      canvasNode.height = height * dpr
      const ctx = canvasNode.getContext('2d')
      ctx.scale(dpr, dpr)

      ctx.fillStyle = '#f6fcfa'
      ctx.fillRect(0, 0, width, height)

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(30, 30, width - 60, height - 120)

      ctx.fillStyle = '#5cd6b4'
      ctx.fillRect(50, 50, 80, 32)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 14px sans-serif'
      ctx.fillText(questionTypeText(data.type), 58, 72)

      ctx.fillStyle = '#0f2027'
      ctx.font = 'bold 18px sans-serif'
      const titleLines = wrapText(ctx, data.title, width - 120)
      let y = 110
      for (const line of titleLines.slice(0, 4)) {
        ctx.fillText(line, 50, y)
        y += 28
      }

      ctx.font = '15px sans-serif'
      ctx.fillStyle = '#4b5f6b'
      y += 10
      for (const opt of (data.options || []).slice(0, 4)) {
        ctx.fillText(`${opt.key}. ${opt.content.slice(0, 25)}`, 50, y)
        y += 30
      }

      ctx.fillStyle = '#8fb0b6'
      ctx.font = '13px sans-serif'
      ctx.fillText('长按识别小程序码 · 一起来刷题', 50, height - 60)
      ctx.fillText('医护专转本刷题助手', width - 180, height - 60)

      const tempPath = await new Promise<string>((resolve) => {
        Taro.canvasToTempFilePath({
          canvas: canvasNode,
          width: width * dpr,
          height: height * dpr,
          destWidth: width * dpr,
          destHeight: height * dpr,
          success: (res) => resolve(res.tempFilePath),
          fail: () => resolve(''),
        })
      })
      Taro.hideLoading()
      if (tempPath) {
        await Taro.saveImageToPhotosAlbum({ filePath: tempPath })
        Taro.showToast({ title: '已保存到相册', icon: 'success' })
      } else {
        Taro.showToast({ title: '生成失败', icon: 'none' })
      }
    } catch (err: any) {
      Taro.hideLoading()
      if (err?.errMsg?.includes('auth deny')) {
        Taro.showToast({ title: '请允许保存图片权限', icon: 'none' })
      } else {
        Taro.showToast({ title: '保存失败', icon: 'none' })
      }
    }
  }

  function wrapText(ctx: any, text: string, maxWidth: number): string[] {
    const lines: string[] = []
    let line = ''
    for (const char of text) {
      const testLine = line + char
      if (ctx.measureText(testLine).width > maxWidth) {
        lines.push(line)
        line = char
      } else {
        line = testLine
      }
    }
    if (line) lines.push(line)
    return lines
  }

  // 【功能1】打开答题卡并加载题目列表
  async function openAnswerSheet() {
    if (!data) return
    setShowAnswerSheet(true)
    if (sheetQuestionIds.length === 0) {
      try {
        const mc = currentModuleCode
        if (mc) {
          const list = await getModuleQuestions(mc)
          setSheetQuestionIds(list.map((q) => q.id))
        }
      } catch {}
    }
  }

  function goToSheetQuestion(index: number) {
    const targetId = sheetQuestionIds[index]
    if (!targetId || targetId === questionId) return
    if (data) {
      const newHistory = [...questionHistory, data.id]
      setQuestionHistory(newHistory)
      try { Taro.setStorageSync('cfqh_question_history', JSON.stringify(newHistory.slice(-50))) } catch {}
    }
    setShowAnswerSheet(false)
    Taro.redirectTo({ url: `/pages/question-detail/index?id=${targetId}${currentModuleCode ? `&moduleCode=${currentModuleCode}` : ''}` })
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
          <Text className={styles.lockDesc}>{isError ? loadErrorText : '正在读取授权题目内容。'}</Text>
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
  const isReviewMode = practiceMode === 'review'
  const reviewTabs = [
    { key: 'analysis' as const, label: '解析', visible: true },
    { key: 'case' as const, label: '案例', visible: Boolean(data.caseMaterial) },
    { key: 'confusing' as const, label: '易混点', visible: Boolean(data.confusingPoint) },
    { key: 'memory' as const, label: '记忆', visible: Boolean(data.memoryTip) },
  ].filter((item) => item.visible)
  const currentReviewTab = reviewTabs.some((item) => item.key === activeReviewTab) ? activeReviewTab : 'analysis'

  return (
    <View className={styles.page}>
      {/* 【功能1】模式切换 Tab */}
      <View className={styles.modeSwitch}>
        <View className={cx(styles.modeTab, practiceMode === 'review' && styles.modeTabActive)} onTap={() => setPracticeMode('review')}>
          <Text className={cx(styles.modeTabText, practiceMode === 'review' && styles.modeTabTextActive)}>背题模式</Text>
        </View>
        <View className={cx(styles.modeTab, practiceMode === 'answer' && styles.modeTabActive)} onTap={() => setPracticeMode('answer')}>
          <Text className={cx(styles.modeTabText, practiceMode === 'answer' && styles.modeTabTextActive)}>答题模式</Text>
        </View>
      </View>

      <View className={cx(styles.progressHeader, [10, 20, 50, 100].includes(data.progress.current) && styles.progressMilestone, [10, 20, 50, 100].includes(data.progress.current) && styles.progressBounce)}>
        <Text className={styles.progressLabel}>第 {data.progress.current} / {data.progress.total} 题</Text>
        <View className={styles.progressTrack}>
          <View className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </View>
      </View>

      <View className={cx(styles.questionCard, feedbackAnim === 'correct' && styles.cardCorrectPulse, feedbackAnim === 'wrong' && styles.cardWrongShake)}>
        <View className={styles.tagRow}>
          <Text className={styles.typeTag}>{questionTypeText(data.type)}</Text>
          <Text className={styles.levelText}>难度：{data.difficultyText}</Text>
        </View>
        <Text className={styles.questionTitle}>{data.title}</Text>
        {settings.timerEnabled && !submitted && !isReviewMode && (
          <Text className={styles.levelText} style={{ color: timer <= 10 ? '#f87171' : undefined }}>⏱ {timer}s</Text>
        )}
        <View className={styles.options}>
          {displayOptions.map((option) => {
            const active = data.type === 'multiple_choice' ? selected.includes(option.key) : selected === option.key
            // 【功能7】只在已提交状态下才显示对错颜色，重做时 submitted=false 不会有红色
            const correct = (submitted || isReviewMode) && data.answer.includes(option.key)
            const wrong = submitted && !isReviewMode && active && !data.answer.includes(option.key)
            return (
              <View key={option.key} className={cx(styles.option, active && !isReviewMode && styles.optionActive, correct && styles.optionCorrect, wrong && styles.optionWrong)} onTap={() => handleOptionTap(option.key)}>
                <Text className={styles.optionKey}>{option.key}</Text>
                <Text className={styles.optionText}>{option.content}</Text>
                {correct && <Text className={styles.optionStatus}>✓</Text>}
                {wrong && <Text className={styles.optionStatus}>✗</Text>}
              </View>
            )
          })}
        </View>
      </View>

      {/* 【功能1】背题模式直接显示解析 */}
      {isReviewMode && (
        <View className={styles.reviewCard}>
          <View className={styles.answerPanel}>
            <View className={styles.answerCol}>
              <Text className={styles.answerLabel}>正确答案</Text>
              <Text className={styles.correctColor}>{data.answer}</Text>
            </View>
          </View>
          <View className={styles.reviewTabs}>
            {reviewTabs.map((item) => (
              <View key={item.key} className={cx(styles.reviewTab, currentReviewTab === item.key && styles.reviewTabActive)} onTap={() => setActiveReviewTab(item.key)}>
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
        </View>
      )}

      {/* 答题模式 - 提交后显示结果 */}
      {!isReviewMode && submitted && (
        <View className={styles.answerPanel}>
          <View className={styles.answerCol}>
            <Text className={styles.answerLabel}>你的答案</Text>
            <Text className={cx(styles.answerValue, isCorrect ? styles.correctColor : styles.wrongColor)}>{selected}</Text>
          </View>
          <View className={styles.answerCol}>
            <Text className={styles.answerLabel}>正确答案</Text>
            <Text className={styles.correctColor}>{data.answer}</Text>
          </View>
          {isCorrect && settings.autoNext && data.nextQuestionId && (
            <View className={styles.answerCol}>
              <Text className={styles.answerLabel}>即将翻页</Text>
              <Text className={styles.correctColor}>...</Text>
            </View>
          )}
        </View>
      )}

      {!isReviewMode && submitted && (
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
        </View>
      )}

      {/* 答对动画：粒子 + Emoji 弹出 */}
      {feedbackAnim === 'correct' && (
        <View className={styles.fireworkOverlay}>
          {Array.from({ length: 12 }, (_, i) => (
            <View key={i} className={styles.fireworkParticle} style={{ '--angle': `${i * 30}deg`, '--delay': `${i * 0.03}s` } as any} />
          ))}
          <Text className={styles.emojiPop} style={{ '--em-delay': '0s', '--em-x': '-40px', '--em-y': '-60px' } as any}>🎉</Text>
          <Text className={styles.emojiPop} style={{ '--em-delay': '0.1s', '--em-x': '35px', '--em-y': '-80px' } as any}>🎊</Text>
          <Text className={styles.emojiPop} style={{ '--em-delay': '0.15s', '--em-x': '0px', '--em-y': '-100px' } as any}>✨</Text>
          <Text className={styles.emojiPop} style={{ '--em-delay': '0.2s', '--em-x': '-50px', '--em-y': '-30px' } as any}>👏</Text>
          <Text className={styles.emojiPop} style={{ '--em-delay': '0.08s', '--em-x': '50px', '--em-y': '-45px' } as any}>🌟</Text>
        </View>
      )}

      {/* Combo 评价弹出 */}
      {comboDisplay && (
        <View className={cx(styles.comboOverlay, styles[`combo_${comboDisplay.level}`])}>
          <Text className={styles.comboText}>{comboDisplay.text}</Text>
          {comboCount >= 3 && <Text className={styles.comboCount}>x{comboCount} combo</Text>}
        </View>
      )}

      {/* 【功能1】答题卡弹窗 */}
      {showAnswerSheet && (
        <View className={styles.sheetMask} onTap={() => setShowAnswerSheet(false)}>
          <View className={styles.sheetPanel} onTap={(e) => e.stopPropagation()}>
            <View className={styles.sheetHeader}>
              <Text className={styles.sheetTitle}>答题卡</Text>
              <View onTap={() => setShowAnswerSheet(false)}>
                <Text className={styles.sheetClose}>关闭</Text>
              </View>
            </View>
            <View className={styles.sheetGrid}>
              {Array.from({ length: data.progress.total }, (_, i) => {
                const num = i + 1
                const isCurrent = num === data.progress.current
                const isDone = num < data.progress.current
                return (
                  <View key={num} className={cx(styles.sheetCell, isCurrent && styles.sheetCellCurrent, isDone && styles.sheetCellDone)} onTap={() => goToSheetQuestion(i)}>
                    <Text className={styles.sheetCellText}>{num}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        </View>
      )}

      {/* 底部操作栏 */}
      <View className={styles.bottomBar}>
        {isReviewMode ? (
          <>
            <View className={styles.secondaryButton} onTap={goPrev}>上一题</View>
            <View className={styles.nextButton} onTap={goNext}>下一题</View>
          </>
        ) : !submitted ? (
          <>
            <View className={questionHistory.length > 0 ? styles.secondaryButton : styles.secondaryButtonDisabled} onTap={goPrev}>上一题</View>
            <View className={styles.submitButton} onTap={handleSubmit}>{submitting ? '提交中...' : '提交答案'}</View>
          </>
        ) : (
          <>
            <View className={styles.secondaryButton} onTap={handleFavorite}>{favorited || data.isFavorite ? '已收藏' : '收藏'}</View>
            <View className={styles.nextButton} onTap={goNext}>下一题</View>
          </>
        )}
      </View>

      {/* 底部工具栏：收藏、分享、答题卡 */}
      <View className={styles.toolBar}>
        <View className={styles.toolItem} onTap={handleFavorite}>
          <Text className={styles.toolIcon}>{favorited || data.isFavorite ? '★' : '☆'}</Text>
          <Text className={styles.toolLabel}>收藏</Text>
        </View>
        <View className={styles.toolItem} onTap={handleShare}>
          <Text className={styles.toolIcon}>↗</Text>
          <Text className={styles.toolLabel}>分享</Text>
        </View>
        <View className={styles.toolItem} onTap={openAnswerSheet}>
          <Text className={styles.toolIcon}>▦</Text>
          <Text className={styles.toolLabel}>答题卡</Text>
        </View>
      </View>

      {/* 隐藏 Canvas 用于海报生成 */}
      <Canvas className="sharePosterCanvas" canvasId="sharePoster" type="2d" style={{ position: 'fixed', left: 0, top: 0, width: '600px', height: '800px', opacity: 0, pointerEvents: 'none', zIndex: -1 }} />
    </View>
  )
}
