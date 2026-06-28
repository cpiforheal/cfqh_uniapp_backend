import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, Textarea, Button } from '@tarojs/components'
import Taro, { useRouter, useDidHide, useDidShow } from '@tarojs/taro'
import { getExamQuestions, submitExamAnswer, submitExam, reportExamHideEvent, getExamSessionInfo } from '../../services/nursing'
import type { ExamQuestionItem } from '../../services/nursing'
import styles from './index.module.scss'

export default function ExamSessionPage() {
  const router = useRouter()
  const sessionId = router.params.sessionId || ''

  const [questions, setQuestions] = useState<ExamQuestionItem[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [deadline, setDeadline] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const hideTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>()
  const pendingRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const flushPending = useCallback(() => {
    pendingRef.current.forEach((timer) => {
      clearTimeout(timer)
    })
    pendingRef.current.clear()
  }, [])

  useEffect(() => {
    loadSession()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      flushPending()
    }
  }, [flushPending])

  useEffect(() => {
    if (!deadline) return
    timerRef.current = setInterval(() => {
      const left = Math.max(0, deadline - Date.now())
      setRemaining(left)
      if (left <= 0) {
        clearInterval(timerRef.current)
        handleSubmit(true)
      }
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [deadline])

  useDidHide(() => {
    hideTimeRef.current = Date.now()
  })

  useDidShow(() => {
    if (hideTimeRef.current && sessionId) {
      const duration = Date.now() - hideTimeRef.current
      hideTimeRef.current = 0
      reportExamHideEvent(sessionId, duration).catch(() => {})
    }
  })

  async function loadSession() {
    try {
      const sessionInfo = await getExamSessionInfo(sessionId)
      if (!sessionInfo || sessionInfo.status !== 'in_progress') {
        Taro.showToast({ title: '考试已结束', icon: 'none' })
        setTimeout(() => Taro.navigateBack(), 1500)
        return
      }
      setDeadline(new Date(sessionInfo.deadline).getTime())
      const qs = await getExamQuestions(sessionId)
      setQuestions(qs)
      const saved: Record<string, string> = {}
      qs.forEach((q) => { if (q.savedAnswer) saved[q.id] = q.savedAnswer })
      setAnswers(saved)
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '加载失败', icon: 'none' })
    }
  }

  const saveAnswer = useCallback((questionId: string, answer: string) => {
    const existing = pendingRef.current.get(questionId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      pendingRef.current.delete(questionId)
      submitExamAnswer(sessionId, questionId, answer).catch(() => {
        Taro.showToast({ title: '答案暂存失败，请检查网络', icon: 'none', duration: 2000 })
      })
    }, 500)
    pendingRef.current.set(questionId, timer)
  }, [sessionId])

  const flushAndSaveAll = useCallback(async (currentAnswers: Record<string, string>) => {
    flushPending()
    const results = await Promise.allSettled(
      Object.entries(currentAnswers).map(([qId, ans]) =>
        submitExamAnswer(sessionId, qId, ans)
      )
    )
    const failures = results.filter((r) => r.status === 'rejected')
    if (failures.length > 0) {
      throw new Error(`${failures.length} 题保存失败`)
    }
  }, [sessionId, flushPending])

  function handleSelectOption(questionId: string, key: string) {
    if (submitted) return
    const current = answers[questionId] || ''
    const q = questions.find((item) => item.id === questionId)
    let newAnswer: string

    if (q?.type === 'multiple_choice') {
      const selected = current.split('').filter(Boolean)
      if (selected.includes(key)) {
        newAnswer = selected.filter((k) => k !== key).sort().join('')
      } else {
        newAnswer = [...selected, key].sort().join('')
      }
    } else {
      newAnswer = key
    }

    setAnswers((prev) => ({ ...prev, [questionId]: newAnswer }))
    saveAnswer(questionId, newAnswer)
  }

  function handleTextAnswer(questionId: string, value: string) {
    if (submitted) return
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    saveAnswer(questionId, value)
  }

  async function handleSubmit(auto = false) {
    if (submitted) return
    if (!auto) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Taro.showModal({
          title: '确认交卷',
          content: `已答 ${Object.keys(answers).length}/${questions.length} 题，确定交卷？`,
          success: (res) => resolve(res.confirm),
        })
      })
      if (!confirmed) return
    }
    setSubmitted(true)
    try {
      await flushAndSaveAll(answers)
    } catch (flushErr: any) {
      setSubmitted(false)
      Taro.showToast({ title: `答案保存未完成：${flushErr?.message || '网络异常'}，请重试`, icon: 'none', duration: 3000 })
      return
    }
    try {
      await submitExam(sessionId)
      Taro.showToast({ title: auto ? '时间到，已自动交卷' : '交卷成功', icon: 'success' })
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/exam-result/index?sessionId=${sessionId}` })
      }, 1500)
    } catch {
      Taro.showToast({ title: '交卷失败，请重试', icon: 'none' })
      setSubmitted(false)
    }
  }

  function formatTime(ms: number) {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const currentQ = questions[currentIdx]
  const options: Array<{ key: string; content: string }> = currentQ
    ? (() => { try { return JSON.parse(currentQ.optionsJson) } catch { return [] } })()
    : []

  return (
    <View className={styles.sessionPage}>
      <View className={styles.timerBar}>
        <Text className={`${styles.timerText} ${remaining < 300000 ? styles.timerDanger : ''}`}>
          {formatTime(remaining)}
        </Text>
        <Text className={styles.questionProgress}>
          {currentIdx + 1} / {questions.length}
        </Text>
      </View>

      {currentQ && (
        <View className={styles.questionCard}>
          <Text className={styles.questionSeq}>第 {currentQ.seq} 题（{currentQ.score}分）</Text>
          <Text className={styles.questionStem}>{currentQ.stem}</Text>

          {options.length > 0 ? (
            options.map((opt) => (
              <View
                key={opt.key}
                className={`${styles.optionItem} ${(answers[currentQ.id] || '').includes(opt.key) ? styles.optionSelected : ''}`}
                onClick={() => handleSelectOption(currentQ.id, opt.key)}
              >
                <View className={styles.optionKey}><Text>{opt.key}</Text></View>
                <Text className={styles.optionContent}>{opt.content}</Text>
              </View>
            ))
          ) : (
            <Textarea
              className={styles.textAnswer}
              placeholder='请输入答案'
              value={answers[currentQ.id] || ''}
              onInput={(e) => handleTextAnswer(currentQ.id, e.detail.value)}
              maxlength={2000}
            />
          )}
        </View>
      )}

      <View className={styles.navDots}>
        {questions.map((q, idx) => (
          <View
            key={q.id}
            className={`${styles.navDot} ${answers[q.id] ? styles.navDotAnswered : ''} ${idx === currentIdx ? styles.navDotCurrent : ''}`}
            onClick={() => setCurrentIdx(idx)}
          >
            <Text>{idx + 1}</Text>
          </View>
        ))}
      </View>

      <View className={styles.bottomBar}>
        <Button
          className={styles.navBtn}
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
        >上一题</Button>
        {currentIdx < questions.length - 1 ? (
          <Button
            className={styles.navBtn}
            onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
          >下一题</Button>
        ) : (
          <Button
            className={styles.submitBtn}
            disabled={submitted}
            onClick={() => handleSubmit(false)}
          >交卷</Button>
        )}
      </View>
    </View>
  )
}
