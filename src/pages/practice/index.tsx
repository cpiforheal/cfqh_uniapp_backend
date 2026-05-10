import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getLicenseStatus, getLocalPracticeHomeOverview, getPracticeHomeOverview, isAuthorized } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
import type { PracticeQuestionSummary } from '@/types/study'
import styles from './index.module.scss'

function isQuestion(question?: PracticeQuestionSummary): question is PracticeQuestionSummary {
  return Boolean(question)
}

export default function PracticePage() {
  const setAuthorized = useAuthStore((state) => state.setAuthorized)
  const { data: licenseStatus, isLoading: isLicenseLoading } = useQuery({
    queryKey: ['licenseStatus'],
    queryFn: getLicenseStatus,
  })
  const { data, refetch, isRefetching, isError } = useQuery({
    queryKey: ['practiceHome'],
    queryFn: getPracticeHomeOverview,
    initialData: getLocalPracticeHomeOverview,
  })

  useDidShow(() => {
    refetch()
  })

  useEffect(() => {
    if (!licenseStatus?.authorized) return
    const tokenCode = licenseStatus.authorization?.licenseToken?.code
    if (tokenCode) setAuthorized(tokenCode, licenseStatus.authorization?.expiresAt)
    refetch()
  }, [licenseStatus, refetch, setAuthorized])

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

  const remoteAuthorization = data.authorization
  const licenseAuthorization = licenseStatus
    ? { status: licenseStatus.authorized ? 'authorized' as const : 'unauthorized' as const, reason: licenseStatus.reason }
    : null
  const authorized = isAuthorized(remoteAuthorization) || isAuthorized(licenseAuthorization)
  const checkingAuthorization = !authorized && (isLicenseLoading || isRefetching)
  const displayAuthorization = isAuthorized(remoteAuthorization)
    ? remoteAuthorization
    : isAuthorized(licenseAuthorization)
      ? {
          ...remoteAuthorization,
          status: 'authorized' as const,
          tokenCode: licenseStatus?.authorization?.licenseToken?.code || remoteAuthorization?.tokenCode,
          expiresText: licenseStatus?.authorization?.expiresAt ? `有效期至 ${String(licenseStatus.authorization.expiresAt).slice(0, 10)}` : remoteAuthorization?.expiresText,
          resourceScopeText: remoteAuthorization?.resourceScopeText || '医护题库、解析、案例材料、公开讲解',
        }
      : remoteAuthorization
  const authStatusText = displayAuthorization?.status
  const expiresText = displayAuthorization?.expiresText
  const authDaysLeft = (() => {
    if (!expiresText) return null
    const match = expiresText.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
    if (!match) return null
    const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.round((target - today.getTime()) / (1000 * 60 * 60 * 24))
  })()
  const showAuthBanner = authStatusText !== 'authorized' || (authDaysLeft != null && authDaysLeft <= 15)
  const isExpired = authStatusText !== 'authorized' || (authDaysLeft != null && authDaysLeft <= 0)

  function goActivate() {
    Taro.navigateTo({ url: '/pages/activate/index' })
  }

  function goProfile() {
    Taro.switchTab({ url: '/pages/profile/index' })
  }

  function goQuestionBank() {
    Taro.switchTab({ url: '/pages/question-bank/index' })
  }

  function goQuestion(questionId?: string) {
    const targetId = questionId || data.dailyQuestion?.id
    if (!targetId) return
    Taro.navigateTo({ url: `/pages/question-detail/index?id=${targetId}` })
  }

  const percent = progress?.percent || 0

  if (checkingAuthorization) {
    return (
      <View className={styles.page}>
        <View className={styles.lockInfoCard}>
          <Text className={styles.lockInfoTitle}>正在确认授权</Text>
          <Text className={styles.lockInfoText}>正在同步通行码状态和练习首页，请稍候。</Text>
        </View>
      </View>
    )
  }

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
      <View className={styles.hero}>
        <Text className={styles.brandText}>专转本医护大类</Text>
        <Text className={styles.title}>今日医护练习</Text>
        <Text className={styles.desc}>围绕题库目录、每日推荐、错题复盘同步推进，当前账号的练习记录会自动归档。</Text>
      </View>

      <View className={styles.overviewGrid}>
        <View className={styles.overviewCard}>
          <Text className={styles.overviewValue}>{progress?.done || 0}</Text>
          <Text className={styles.overviewLabel}>今日已练</Text>
        </View>
        <View className={styles.overviewCard}>
          <Text className={styles.overviewValue}>{recommendedQuestions.length || 0}</Text>
          <Text className={styles.overviewLabel}>推荐题</Text>
        </View>
        <View className={styles.overviewCard}>
          <Text className={styles.overviewValue}>{data.recentMistakes?.length || 0}</Text>
          <Text className={styles.overviewLabel}>近期错题</Text>
        </View>
      </View>

      <View className={styles.accountPanel}>
        <View className={styles.accountLeft}>
          <Text className={styles.accountTitle}>账号学习状态</Text>
          <Text className={styles.accountDesc}>{expiresText || '通行码已激活，题库与进度已同步'}</Text>
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
          <Text className={styles.emptyTitle}>{isError ? '题目加载失败' : '今日推荐同步中'}</Text>
          <Text className={styles.emptyText}>{isError ? '请下拉刷新，或稍后重新进入首页' : '可以先进入题库目录，按课程章节选择练习内容。'}</Text>
          <View className={styles.emptyButton} onTap={goQuestionBank}>
            <Text className={styles.emptyButtonText}>去题库练习</Text>
          </View>
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
