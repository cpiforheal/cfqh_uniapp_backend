import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { getModuleMastery, getModuleQuestions, getNextQuestionId, getStudyCardDetail, toggleMastery } from '@/services/studyCards'
import type { StudyCardDetail, StudyCardQuestionBrief } from '@/types/studyCard'
import { cx } from '@/utils/classNames'
import styles from './index.module.scss'

export default function StudyCardDetailPage() {
  const router = useRouter()
  const id = router.params.id || ''
  const moduleCode = router.params.moduleCode || ''

  const [detail, setDetail] = useState<StudyCardDetail | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [moduleQuestions, setModuleQuestions] = useState<StudyCardQuestionBrief[]>([])
  const [nextId, setNextId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [mastered, setMastered] = useState(false)

  useEffect(() => {
    setDetail(null)
    setLoadError(false)
    setSelected(null)
    setSubmitted(false)
    getStudyCardDetail(id).then((d) => {
      if (d) setDetail(d)
      else setLoadError(true)
    })
    getModuleQuestions(moduleCode).then(setModuleQuestions)
    getNextQuestionId(moduleCode, id).then(setNextId)
    getModuleMastery(moduleCode).then((list) => setMastered(list.includes(id)))
  }, [id, moduleCode])

  const currentIndex = moduleQuestions.findIndex((q) => q.id === id) + 1
  const totalCount = moduleQuestions.length

  const handleSubmit = useCallback(() => {
    if (!selected || !detail) return
    setSubmitted(true)
  }, [selected, detail])

  const goNext = useCallback(() => {
    if (nextId) {
      Taro.redirectTo({ url: `/pages/study-card-detail/index?id=${nextId}&moduleCode=${moduleCode}` })
    } else {
      Taro.navigateBack()
    }
  }, [nextId, moduleCode])

  const goKnowledgeCards = useCallback(() => {
    if (!detail) return
    Taro.navigateTo({ url: `/pages/study-card-point/index?id=${detail.id}&moduleCode=${moduleCode}` })
  }, [detail, moduleCode])

  if (loadError) {
    return (
      <View className={styles.page}>
        <View className={styles.errorCard}>
          <Text className={styles.errorTitle}>需要通行码</Text>
          <Text className={styles.errorText}>返回列表解锁</Text>
          <View className={styles.errorButton} onTap={() => Taro.navigateBack()}>
            <Text>返回列表</Text>
          </View>
        </View>
      </View>
    )
  }

  if (!detail) {
    return <View className={styles.page}><Text className={styles.loadingText}>加载中...</Text></View>
  }

  const isCorrect = selected === detail.answer
  const progress = totalCount > 0 && currentIndex > 0 ? Math.round((currentIndex / totalCount) * 100) : 0

  return (
    <View className={styles.page}>
      <View className={styles.ticketHeader}>
        <View className={styles.ticketTop}>
          <View>
            <Text className={styles.ticketLabel}>任务单</Text>
            <Text className={styles.ticketTitle}>{detail.moduleName}</Text>
          </View>
          <View className={styles.ticketSeq}>
            <Text className={styles.ticketSeqValue}>{currentIndex || detail.seq}</Text>
            <Text className={styles.ticketSeqLabel}>/{totalCount || '-'}</Text>
          </View>
        </View>
        <View className={styles.progressTrack}>
          <View className={styles.progressFill} style={{ width: `${progress}%` }} />
        </View>
      </View>

      <View className={styles.questionCard}>
        <View className={styles.cardHead}>
          <Text className={styles.typeTag}>{detail.type === 'single_choice' ? '单选' : '判断'}</Text>
          <Text className={styles.cardHint}>提交后看解析</Text>
        </View>
        <Text className={styles.stem}>{detail.stem}</Text>
      </View>

      <View className={styles.optionList}>
        {detail.options.map((opt) => {
          let optClass = ''
          if (submitted) {
            if (opt.key === detail.answer) optClass = styles.optionCorrect
            else if (opt.key === selected) optClass = styles.optionWrong
          } else if (opt.key === selected) {
            optClass = styles.optionActive
          }
          return (
            <View
              key={opt.key}
              className={cx(styles.option, optClass)}
              onTap={() => { if (!submitted) setSelected(opt.key) }}
            >
              <View className={styles.optionKey}><Text>{opt.key}</Text></View>
              <Text className={styles.optionText}>{opt.text}</Text>
            </View>
          )
        })}
      </View>

      {submitted && (
        <View className={styles.afterSubmit}>
          <View className={styles.resultCard}>
            <View className={styles.resultMain}>
              <Text className={cx(styles.resultStatus, isCorrect ? styles.correctColor : styles.wrongColor)}>
                {isCorrect ? '回答正确' : '再看一眼'}
              </Text>
              <Text className={styles.resultDesc}>
                你的答案 {selected || '-'} · 正确答案 {detail.answer}
              </Text>
            </View>
            <View className={cx(styles.resultBadge, isCorrect ? styles.resultBadgeCorrect : styles.resultBadgeWrong)}>
              <Text>{isCorrect ? 'OK' : 'Review'}</Text>
            </View>
          </View>

          {detail.knowledgeCards.length > 0 && (
            <View className={styles.knowledgeOrder} onTap={goKnowledgeCards}>
              <View className={styles.orderLine}>
                <View className={styles.orderDot} />
                <View className={styles.orderRail} />
                <View className={styles.orderDotOrange} />
              </View>
              <View className={styles.knowledgeMain}>
                <Text className={styles.knowledgeTitle}>带背知识点</Text>
                <Text className={styles.knowledgeDesc}>{detail.knowledgeCards.length} 张卡</Text>
              </View>
              <View className={styles.knowledgeButton}>
                <Text>查看</Text>
              </View>
            </View>
          )}

          <View
            className={cx(styles.masteryBar, mastered && styles.masteryBarActive)}
            onTap={() => {
              const next = !mastered
              setMastered(next)
              toggleMastery(id, next)
            }}
          >
            <Text className={styles.masteryCheck}>{mastered ? '已掌握' : '标记掌握'}</Text>
            <Text className={styles.masteryText}>{mastered ? '列表显示复盘' : '加入已掌握'}</Text>
          </View>
        </View>
      )}

      <View className={styles.bottomBar}>
        {!submitted ? (
          <View
            className={cx(styles.submitButton, !selected && styles.buttonDisabled)}
            onTap={selected ? handleSubmit : undefined}
          >
            <Text>提交答案</Text>
          </View>
        ) : (
          <View className={styles.nextButton} onTap={goNext}>
            <Text>{nextId ? '下一题' : '返回列表'}</Text>
          </View>
        )}
      </View>
    </View>
  )
}
