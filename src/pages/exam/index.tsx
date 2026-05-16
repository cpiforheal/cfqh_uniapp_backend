import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { joinExam, getActiveExamSession, getExamHistory } from '../../services/nursing'
import type { ExamSessionInfo, ExamHistoryItem } from '../../services/nursing'
import styles from './index.module.scss'

export default function ExamPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeSession, setActiveSession] = useState<ExamSessionInfo | null>(null)
  const [history, setHistory] = useState<ExamHistoryItem[]>([])

  useDidShow(() => {
    loadData()
  })

  async function loadData() {
    try {
      const [active, hist] = await Promise.all([
        getActiveExamSession(),
        getExamHistory(),
      ])
      setActiveSession(active)
      setHistory(hist)
    } catch {}
  }

  function normalizeCode(input: string) {
    return input.replace(/[^A-Za-z0-9-]/g, '').toUpperCase().slice(0, 12)
  }

  async function handleJoin() {
    const trimmed = code.trim()
    if (!trimmed) return
    setLoading(true)
    try {
      const result = await joinExam(trimmed)
      Taro.navigateTo({ url: `/pages/exam-session/index?sessionId=${result.sessionId}` })
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '验码失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  function handleContinue() {
    if (!activeSession) return
    Taro.navigateTo({ url: `/pages/exam-session/index?sessionId=${activeSession.sessionId}` })
  }

  function handleHistoryItem(item: ExamHistoryItem) {
    if (item.status === 'in_progress') {
      Taro.navigateTo({ url: `/pages/exam-session/index?sessionId=${item.id}` })
      return
    }
    Taro.navigateTo({ url: `/pages/exam-result/index?sessionId=${item.id}` })
  }

  function getHistoryStatusText(item: ExamHistoryItem) {
    if (item.totalScore !== null) return `${item.totalScore}分`
    if (item.status === 'in_progress') return '未交卷'
    if (item.status === 'graded') return '已批改'
    return '待批改'
  }

  return (
    <View className={styles.examPage}>
      <View className={styles.header}>
        <Text className={styles.title}>在线模考</Text>
        <Text className={styles.subtitle}>输入考试码开始答题</Text>
      </View>

      {activeSession && (
        <View className={styles.activeSession}>
          <Text className={styles.activeTitle}>进行中的考试</Text>
          <Text className={styles.activeExamName}>{activeSession.exam.title}</Text>
          <Button className={styles.continueBtn} onClick={handleContinue}>继续答题</Button>
        </View>
      )}

      <View className={styles.codeSection}>
        <Text className={styles.codeLabel}>考试码</Text>
        <Input
          className={styles.codeInput}
          placeholder='EXM-XXXXXXXX'
          value={code}
          onInput={(e) => setCode(normalizeCode(e.detail.value))}
          maxlength={12}
        />
        <Button
          className={`${styles.joinBtn} ${(!code.trim() || loading) ? styles.joinBtnDisabled : ''}`}
          disabled={!code.trim() || loading}
          onClick={handleJoin}
        >
          {loading ? '验证中...' : '进入考试'}
        </Button>
      </View>

      {history.length > 0 && (
        <View className={styles.historySection}>
          <Text className={styles.historyTitle}>历史考试</Text>
          {history.map((item) => (
            <View
              key={item.id}
              className={styles.historyItem}
              onClick={() => handleHistoryItem(item)}
            >
              <View>
                <Text className={styles.historyName}>{item.exam.title}</Text>
                <Text className={styles.historyMeta}>
                  {item.createdAt?.slice(0, 10)}
                </Text>
              </View>
              {item.totalScore !== null || item.status === 'graded' ? (
                <Text className={styles.historyScore}>{getHistoryStatusText(item)}</Text>
              ) : (
                <Text className={styles.historyPending}>{getHistoryStatusText(item)}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {!activeSession && history.length === 0 && (
        <Text className={styles.emptyHint}>暂无考试记录，输入考试码开始</Text>
      )}
    </View>
  )
}
