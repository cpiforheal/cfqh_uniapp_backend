import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getLicenseStatus, getModuleQuestions } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
import type { PracticeQuestionSummary } from '@/types/study'
import { cx } from '@/utils/classNames'
import styles from './index.module.scss'

type FilterType = 'all' | 'wrong' | 'undone' | 'favorite'

export default function QuestionBankModulePage() {
  const router = Taro.useRouter()
  const moduleCode = String(router.params.moduleCode || 'anatomy')
  const moduleName = decodeURIComponent(String(router.params.moduleName || '医护模块'))
  const setAuthorized = useAuthStore((state) => state.setAuthorized)
  const { data: licenseStatus } = useQuery({
    queryKey: ['licenseStatus'],
    queryFn: getLicenseStatus,
    staleTime: 30000,
  })
  const [questions, setQuestions] = useState<PracticeQuestionSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [expandedChapter, setExpandedChapter] = useState<string>('')
  const [filter, setFilter] = useState<FilterType>('all')

  const authorized = Boolean(licenseStatus?.authorized)

  const loadQuestions = useCallback(async () => {
    setIsLoading(true)
    try {
      const status = await getLicenseStatus()
      if (!status.authorized) { setQuestions([]); return }
      const tokenCode = status.authorization?.licenseToken?.code
      if (tokenCode) setAuthorized(tokenCode, status.authorization?.expiresAt)
      setQuestions(await getModuleQuestions(moduleCode))
    } catch {
      setQuestions([])
    } finally {
      setIsLoading(false)
    }
  }, [moduleCode, setAuthorized])

  useEffect(() => {
    if (licenseStatus?.authorized) loadQuestions()
  }, [licenseStatus, loadQuestions])

  useDidShow(() => { if (authorized) loadQuestions() })

  usePullDownRefresh(async () => {
    await loadQuestions()
    Taro.stopPullDownRefresh()
  })
  const chapterGroups = useMemo(() => {
    const map = new Map<string, PracticeQuestionSummary[]>()
    let globalIdx = 0
    questions.forEach((q) => {
      const ch = (q.chapter || '未归类').trim()
      if (!map.has(ch)) map.set(ch, [])
      globalIdx++
      map.get(ch)!.push({ ...q, orderIndex: q.orderIndex ?? globalIdx })
    })
    return Array.from(map.entries()).map(([chapter, items]) => ({ chapter, questions: items }))
  }, [questions])

  const totalCount = questions.length
  const doneCount = questions.filter((q) => q.completed).length
  const wrongCount = questions.filter((q) => q.wrongCount && q.wrongCount > 0).length
  const favoriteCount = questions.filter((q) => q.isFavorite).length
  const undoneCount = questions.filter((q) => !q.completed && !(q.wrongCount && q.wrongCount > 0)).length
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  const correctRate = doneCount > 0 ? Math.round(((doneCount - wrongCount) / doneCount) * 100) : 0

  const filterCounts: Record<FilterType, number> = {
    all: totalCount,
    wrong: wrongCount,
    favorite: favoriteCount,
    undone: undoneCount,
  }

  function toggleChapter(chapter: string) {
    setExpandedChapter(expandedChapter === chapter ? '' : chapter)
  }

  function getFilteredQuestions(items: PracticeQuestionSummary[]) {
    if (filter === 'wrong') return items.filter((q) => q.wrongCount && q.wrongCount > 0)
    if (filter === 'favorite') return items.filter((q) => q.isFavorite)
    if (filter === 'undone') return items.filter((q) => !q.completed && !(q.wrongCount && q.wrongCount > 0))
    return items
  }

  function getChapterStats(items: PracticeQuestionSummary[]) {
    const total = items.length
    const done = items.filter((q) => q.completed).length
    const wrong = items.filter((q) => q.wrongCount && q.wrongCount > 0).length
    const rate = done > 0 ? Math.round(((done - wrong) / done) * 100) : 0
    return { total, done, wrong, rate }
  }

  function goQuestion(id: string) {
    Taro.navigateTo({ url: `/pages/question-detail/index?id=${id}` })
  }

  function goSequentialPractice(chapterQuestions: PracticeQuestionSummary[]) {
    const firstUndone = chapterQuestions.find((q) => !q.completed && !(q.wrongCount && q.wrongCount > 0))
    const target = firstUndone || chapterQuestions[0]
    if (target) goQuestion(target.id)
  }

  function getCellStyle(q: PracticeQuestionSummary): string {
    return cx(
      q.completed && styles.numberCellDone,
      Boolean(q.wrongCount && q.wrongCount > 0) && styles.numberCellWrong,
    )
  }

  return (
    <View className={styles.page}>
      <View className={styles.decoBlob1} />
      <View className={styles.decoBlob2} />
      <View className={styles.header}>
        <Text className={styles.title}>{moduleName}</Text>
        <Text className={styles.stats}>共 {totalCount} 题 · 已做 {doneCount} · 正确率 {correctRate}%</Text>
        <View className={styles.progressTrack}>
          <View className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </View>
      </View>

      {!authorized ? (
        <View className={styles.lockCard}>
          <Text className={styles.lockTitle}>{isLoading ? '正在确认授权' : '题目已锁定'}</Text>
          <Text className={styles.lockDesc}>激活通行码后查看本模块题目。</Text>
          {!isLoading && (
            <View className={styles.lockBtn} onTap={() => Taro.navigateTo({ url: '/pages/activate/index' })}>
              <Text className={styles.lockBtnText}>去激活</Text>
            </View>
          )}
        </View>
      ) : (
        <>
          <View className={styles.filterRow}>
            {([['all', '全部'], ['wrong', '错题'], ['favorite', '收藏'], ['undone', '未做']] as const).map(([key, label]) => (
              <View key={key} className={cx(styles.filterTag, filter === key && styles.filterTagActive)} onTap={() => setFilter(key)}>
                <Text className={cx(styles.filterText, filter === key && styles.filterTextActive)}>
                  {label}{filterCounts[key] > 0 ? `(${filterCounts[key]})` : ''}
                </Text>
              </View>
            ))}
          </View>

          {isLoading && questions.length === 0 ? (
            <View className={styles.emptyCard}><Text className={styles.emptyText}>加载中...</Text></View>
          ) : chapterGroups.length === 0 ? (
            <View className={styles.emptyCard}><Text className={styles.emptyText}>暂无已发布题目</Text></View>
          ) : (
            <View className={styles.chapterList}>
              {chapterGroups.map((group) => {
                const isExpanded = expandedChapter === group.chapter
                const filtered = getFilteredQuestions(group.questions)
                const stats = getChapterStats(group.questions)
                const allDone = stats.done === stats.total && stats.total > 0
                return (
                  <View key={group.chapter} className={styles.chapterSection}>
                    <View className={cx(styles.chapterRow, allDone && styles.chapterRowDone)} onTap={() => toggleChapter(group.chapter)}>
                      <Text className={styles.chapterIcon}>{allDone ? '✓' : isExpanded ? '▾' : '▸'}</Text>
                      <View className={styles.chapterInfo}>
                        <Text className={styles.chapterName}>{group.chapter}</Text>
                        <Text className={styles.chapterMeta}>
                          {stats.done}/{stats.total} 已做{stats.rate > 0 ? ` · ${stats.rate}%正确` : ''}
                        </Text>
                      </View>
                      {!allDone && (
                        <View className={styles.chapterBtn} onTap={(e) => { e.stopPropagation(); goSequentialPractice(group.questions) }}>
                          <Text className={styles.chapterBtnText}>练习</Text>
                        </View>
                      )}
                    </View>
                    {isExpanded && (
                      <View className={styles.gridWrap}>
                        {filtered.length > 0 ? (
                          <View className={styles.gridGroups}>
                            {Array.from({ length: Math.ceil(filtered.length / 10) }, (_, gi) => {
                              const chunk = filtered.slice(gi * 10, gi * 10 + 10)
                              return (
                                <View key={gi} className={styles.numberGrid}>
                                  {chunk.map((q) => (
                                    <View key={q.id} className={cx(styles.numberCell, getCellStyle(q))} onTap={() => goQuestion(q.id)}>
                                      <Text className={styles.numberText}>{q.orderIndex}</Text>
                                      {Boolean(q.wrongCount && q.wrongCount > 0) && <Text className={styles.wrongMark}>!</Text>}
                                    </View>
                                  ))}
                                </View>
                              )
                            })}
                          </View>
                        ) : (
                          <View className={styles.noMatchWrap}>
                            <Text className={styles.noMatch}>
                              {filter === 'wrong' ? '本章无错题，继续保持 👍' : filter === 'favorite' ? '本章暂无收藏' : '本章已全部完成 🎉'}
                            </Text>
                          </View>
                        )}
                        <View className={styles.gridLegend}>
                          <View className={styles.legendItem}><View className={styles.legendDot} /><Text className={styles.legendText}>未做</Text></View>
                          <View className={styles.legendItem}><View className={cx(styles.legendDot, styles.legendDotDone)} /><Text className={styles.legendText}>已做</Text></View>
                          <View className={styles.legendItem}><View className={cx(styles.legendDot, styles.legendDotWrong)} /><Text className={styles.legendText}>做错</Text></View>
                        </View>
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          )}
        </>
      )}
    </View>
  )
}
