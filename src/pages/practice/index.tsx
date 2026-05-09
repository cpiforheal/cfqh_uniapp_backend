import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getLocalPracticeHomeOverview, getPracticeHomeOverview, isAuthorized } from '@/services/nursing'
import type { PracticeQuestionSummary } from '@/types/study'
import styles from './index.module.scss'

function isQuestion(question?: PracticeQuestionSummary): question is PracticeQuestionSummary {
  return Boolean(question)
}

export default function PracticePage() {
  const { data, refetch, isRefetching, isError } = useQuery({
    queryKey: ['practiceHome'],
    queryFn: getPracticeHomeOverview,
    initialData: getLocalPracticeHomeOverview,
  })

  useDidShow(() => {
    refetch()
  })

  usePullDownRefresh(async () => {
    await refetch()
    Taro.stopPullDownRefresh()
  })

  useEffect(() => {
    if (!isRefetching) {
      Taro.stopPullDownRefresh()
    }
  }, [isRefetching])

  const progress = data.progress
  const dailyQuestionId = data.dailyQuestion?.id
  const continueQuestionId = data.continueQuestion?.id || dailyQuestionId
  const recommendedQuestions = (data.recommendedQuestions?.length ? data.recommendedQuestions : [data.dailyQuestion])
    .filter(isQuestion)
    .filter((question, index, list) => list.findIndex((item) => item?.id === question?.id) === index)
    .slice(0, 5)

  const authStatus = data.authorization?.status
  const authorized = isAuthorized(data.authorization)
  const expiresText = data.authorization?.expiresText
  const authDaysLeft = (() => {
    if (!expiresText) return null
    const match = expiresText.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
    if (!match) return null
    const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.round((target - today.getTime()) / (1000 * 60 * 60 * 24))
  })()
  const showAuthBanner = authStatus !== 'authorized' || (authDaysLeft != null && authDaysLeft <= 15)
  const isExpired = authStatus !== 'authorized' || (authDaysLeft != null && authDaysLeft <= 0)

  function goActivate() {
    Taro.navigateTo({ url: '/pages/activate/index' })
  }

  function goProfile() {
    Taro.switchTab({ url: '/pages/profile/index' })
  }

  function goQuestion(questionId?: string) {
    const targetId = questionId || data.dailyQuestion?.id
    if (!targetId) return
    Taro.navigateTo({ url: `/pages/question-detail/index?id=${targetId}` })
  }

  const percent = progress?.percent || 0

  if (!authorized) {
    return (
      <View className={styles.page}>
        <View className={styles.frameworkHero}>
          <Text className={styles.frameworkKicker}>专转本医护大类</Text>
          <Text className={styles.frameworkTitle}>题库、解析、错题与讲解统一收在这里</Text>
          <Text className={styles.frameworkDesc}>输入老师发放的学习通行码后，系统会绑定当前微信账号并展示你的练习进度。</Text>
          <View className={styles.frameworkButton} onTap={goActivate}>
            <Text className={styles.frameworkButtonText}>输入通行码</Text>
          </View>
        </View>

        <View className={styles.frameworkGrid}>
          {[
            ['人体解剖学', '章节题库与知识点解析'],
            ['生理学', '高频考点与错题回顾'],
            ['临床医学概论', '症状、疾病与辅助检查'],
            ['临床技能操作', '技能流程与公开讲解'],
          ].map((item, index) => (
            <View className={styles.frameworkCard} key={item[0]}>
              <Text className={styles.frameworkIndex}>{index + 1}</Text>
              <Text className={styles.frameworkName}>{item[0]}</Text>
              <Text className={styles.frameworkMeta}>{item[1]}</Text>
            </View>
          ))}
        </View>

        <View className={styles.lockInfoCard}>
          <Text className={styles.lockInfoTitle}>激活后解锁</Text>
          <Text className={styles.lockInfoText}>今日练习、章节题目、答案解析、收藏错题、学习记录和公开视频都会以账号维度实时同步。</Text>
        </View>
      </View>
    )
  }

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <View>
          <Text className={styles.pageTitle}>今日医护练习</Text>
          <Text className={styles.pageSubtitle}>循序刷题 稳步提升</Text>
        </View>
        <View className={styles.streakPill}>
          <Text className={styles.streakNum}>{data.weeklyCompletedCount || 0}</Text>
          <Text className={styles.streakLabel}>本周打卡</Text>
        </View>
      </View>

      {showAuthBanner && (
        <View
          className={`${styles.authBanner} ${isExpired ? styles.authBannerDanger : styles.authBannerWarning}`}
          onTap={isExpired ? goActivate : goProfile}
        >
          <View className={styles.authBannerLeft}>
            <Text className={styles.authBannerTitle}>
              {isExpired ? '通行码已失效' : '通行码即将到期'}
            </Text>
            <Text className={styles.authBannerDesc}>
              {isExpired
                ? '题库已锁定，激活后可继续练习'
                : `剩余 ${authDaysLeft} 天，请提前联系发放方更换`}
            </Text>
          </View>
          <Text className={styles.authBannerAction}>
            {isExpired ? '去激活' : '查看'}
          </Text>
        </View>
      )}

      <View className={styles.heroCard} onTap={() => goQuestion(continueQuestionId)}>
        <View className={styles.heroTopRow}>
          <Text className={styles.heroLabel}>继续练习</Text>
          <Text className={styles.heroPercent}>{percent}%</Text>
        </View>
        <Text className={styles.heroTitle}>
          {data.continueQuestion?.title || '生命体征观察要点'}
        </Text>
        <Text className={styles.heroMeta}>
          {data.continueQuestion?.chapter || '基础护理学'} · 上次停留
        </Text>
        <View className={styles.progressTrack}>
          <View className={styles.progressFill} style={{ width: `${percent}%` }} />
        </View>
        <View className={styles.progressFoot}>
          <Text className={styles.progressText}>已练 {progress?.done || 0} / {progress?.total || 0}</Text>
          <Text className={styles.heroAction}>继续</Text>
        </View>
      </View>

      <View className={styles.sectionHeader}>
        <Text className={styles.sectionTitle}>今日推荐</Text>
        <Text className={styles.sectionMeta}>{recommendedQuestions.length || 0} 题</Text>
      </View>
      {recommendedQuestions.length > 0 ? (
        <View className={styles.recommendList}>
          {recommendedQuestions.map((question, index) => (
            <View className={styles.questionCard} key={question.id} onTap={() => goQuestion(question.id)}>
              <View className={styles.questionIndex}>
                <Text className={styles.questionIndexText}>{index + 1}</Text>
              </View>
              <View className={styles.questionMain}>
                <Text className={styles.questionTitle}>{question.title}</Text>
                <Text className={styles.questionMeta}>
                  {question.chapter || '医护基础'} · {question.difficultyText || '基础'}
                </Text>
              </View>
              <Text className={styles.questionCta}>练习</Text>
            </View>
          ))}
        </View>
      ) : (
        <View className={styles.emptyCard}>
          <Text className={styles.emptyText}>{isError ? '题目加载失败，请下拉重试' : '暂无今日推荐题目'}</Text>
        </View>
      )}

      {data.recentMistakes?.length > 0 && (
        <>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>近期错题</Text>
            <Text className={styles.sectionMeta}>共 {data.recentMistakes.length} 题</Text>
          </View>
          <View className={styles.mistakeList}>
            {data.recentMistakes.slice(0, 3).map((item) => (
              <View className={styles.mistakeItem} key={item.id} onTap={() => goQuestion(item.id)}>
                <View className={styles.mistakeMain}>
                  <Text className={styles.mistakeTitle}>{item.stem || item.title}</Text>
                  <Text className={styles.mistakeChapter}>{item.chapter || '医护基础'}</Text>
                </View>
                <View className={styles.mistakeBadge}>
                  <Text className={styles.mistakeBadgeText}>错 {item.wrongCount || 1}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  )
}
