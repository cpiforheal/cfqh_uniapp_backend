import { Input, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { activateStudyCardLicense, getModuleMastery, getModuleQuestions } from '@/services/studyCards'
import type { StudyCardQuestionBrief } from '@/types/studyCard'
import { cx } from '@/utils/classNames'
import styles from './index.module.scss'

type FilterKey = 'all' | 'todo' | 'mastered' | 'locked'

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'todo', label: '未掌握' },
  { key: 'mastered', label: '已掌握' },
  { key: 'locked', label: '已锁定' },
]

function getModuleTitle(name: string) {
  return name.endsWith('带背') ? name : `${name}带背`
}

export default function StudyCardListPage() {
  const router = useRouter()
  const moduleCode = router.params.moduleCode || ''
  const moduleName = decodeURIComponent(router.params.moduleName || '')

  const [questions, setQuestions] = useState<StudyCardQuestionBrief[]>([])
  const [masteredIds, setMasteredIds] = useState<string[]>([])
  const [filter, setFilter] = useState<FilterKey>('all')
  const [showActivate, setShowActivate] = useState(false)
  const [code, setCode] = useState('')
  const [activating, setActivating] = useState(false)

  const loadQuestions = useCallback(() => {
    if (!moduleCode) return
    getModuleQuestions(moduleCode).then(setQuestions)
    getModuleMastery(moduleCode).then(setMasteredIds)
  }, [moduleCode])

  useEffect(() => { loadQuestions() }, [loadQuestions])

  const masteredSet = useMemo(() => new Set(masteredIds), [masteredIds])
  const lockedCount = questions.filter((q) => q.locked).length
  const masteredCount = questions.filter((q) => masteredSet.has(q.id)).length
  const todoCount = questions.filter((q) => !q.locked && !masteredSet.has(q.id)).length
  const freeCount = questions.length - lockedCount
  const filteredQuestions = questions.filter((q) => {
    if (filter === 'locked') return q.locked
    if (filter === 'mastered') return masteredSet.has(q.id)
    if (filter === 'todo') return !q.locked && !masteredSet.has(q.id)
    return true
  })

  function goDetail(q: StudyCardQuestionBrief) {
    if (q.locked) {
      setShowActivate(true)
      return
    }
    Taro.navigateTo({
      url: `/pages/study-card-detail/index?id=${q.id}&moduleCode=${moduleCode}`,
    })
  }

  async function handleActivate() {
    if (!code.trim()) return
    setActivating(true)
    try {
      const result = await activateStudyCardLicense(code.trim())
      if (result.authorized) {
        Taro.showToast({ title: '激活成功', icon: 'success' })
        setShowActivate(false)
        setCode('')
        loadQuestions()
      } else {
        const msgs: Record<string, string> = {
          not_found: '授权码不存在',
          expired: '授权码已过期',
          disabled: '授权码已禁用',
          bound_to_other_account: '该码已被其他账号使用',
        }
        Taro.showToast({ title: msgs[result.reason] || '激活失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '网络错误，请重试', icon: 'none' })
    } finally {
      setActivating(false)
    }
  }

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.kicker}>带背任务</Text>
        <Text className={styles.title}>{getModuleTitle(moduleName)}</Text>
        <View className={styles.headerStats}>
          <View className={styles.statBlock}>
            <Text className={styles.statValue}>{freeCount}</Text>
            <Text className={styles.statLabel}>可做</Text>
          </View>
          <View className={styles.statBlock}>
            <Text className={styles.statValue}>{todoCount}</Text>
            <Text className={styles.statLabel}>未掌握</Text>
          </View>
          <View className={styles.statBlock}>
            <Text className={styles.statValueOrange}>{lockedCount}</Text>
            <Text className={styles.statLabel}>锁定</Text>
          </View>
        </View>
      </View>

      <View className={styles.filterPanel}>
        <View className={styles.filterTop}>
          <Text className={styles.filterTitle}>筛选</Text>
          <Text className={styles.filterHint}>5 题免费</Text>
        </View>
        <View className={styles.filterRow}>
          {FILTERS.map((item) => (
            <View
              key={item.key}
              className={cx(styles.filterChip, filter === item.key && styles.filterChipActive)}
              onTap={() => setFilter(item.key)}
            >
              <Text>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className={styles.list}>
        {filteredQuestions.map((q) => {
          const mastered = masteredSet.has(q.id)
          return (
            <View key={q.id} className={cx(styles.orderCard, q.locked && styles.orderCardLocked)} onTap={() => goDetail(q)}>
              <View className={styles.cardHead}>
                <View className={styles.cardMeta}>
                  <Text className={styles.distanceText}>第 {q.seq} 题</Text>
                  <Text className={styles.timeText}>{q.knowledgeCardCount} 卡</Text>
                </View>
                <Text className={cx(styles.statusText, q.locked && styles.statusLocked, mastered && styles.statusDone)}>
                  {q.locked ? '待解锁' : mastered ? '已掌握' : '待完成'}
                </Text>
              </View>

              <View className={styles.routeBox}>
                <View className={styles.routeRail}>
                  <View className={styles.startDot} />
                  <View className={styles.railLine} />
                  <View className={q.locked ? styles.lockDot : styles.endDot} />
                </View>
                <View className={styles.routeContent}>
                  <Text className={styles.routeTitle}>{q.knowledgeCardTitle || '带背知识点'}</Text>
                  <Text className={styles.routeDesc}>
                    {q.locked ? '需通行码' : '答后看卡'}
                  </Text>
                </View>
              </View>

              <View className={styles.cardFoot}>
                <View className={styles.badgeRow}>
                  <Text className={styles.badge}>单题</Text>
                  <Text className={styles.badge}>带背</Text>
                  {mastered && <Text className={styles.badgeDone}>可复盘</Text>}
                </View>
                <View className={cx(styles.actionButton, q.locked && styles.actionButtonLocked)}>
                  <Text>{q.locked ? '解锁' : mastered ? '复盘' : '开始'}</Text>
                </View>
              </View>
            </View>
          )
        })}
        {filteredQuestions.length === 0 && (
          <View className={styles.emptyCard}>
            <Text className={styles.emptyTitle}>暂无题目</Text>
            <Text className={styles.emptyText}>切换筛选</Text>
          </View>
        )}
      </View>

      {showActivate && (
        <View className={styles.overlay} onTap={() => setShowActivate(false)}>
          <View className={styles.activateModal} onTap={(e) => e.stopPropagation()}>
            <Text className={styles.modalTitle}>解锁带背</Text>
            <Text className={styles.modalDesc}>输入 SC 通行码</Text>
            <Input
              className={styles.modalInput}
              placeholder="请输入通行码"
              value={code}
              onInput={(e) => setCode(e.detail.value)}
            />
            <View className={styles.modalBtnRow}>
              <View className={styles.modalBtnCancel} onTap={() => setShowActivate(false)}>
                <Text>取消</Text>
              </View>
              <View className={cx(styles.modalBtnConfirm, activating && styles.modalBtnDisabled)} onTap={activating ? undefined : handleActivate}>
                <Text>{activating ? '激活中...' : '激活'}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
