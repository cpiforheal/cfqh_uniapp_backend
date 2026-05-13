import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getHomeConfig, getLicenseStatus, getLocalPracticeHomeOverview, getPracticeHomeOverview, getReviewToday, isAuthorized } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import type { PracticeQuestionSummary } from '@/types/study'
import { cx } from '@/utils/classNames'
import styles from './index.module.scss'

const DAILY_QUOTES = [
  '每天进步一点点，终将跨越那道线。',
  '坚持的意义，在于回头时发现自己走了很远。',
  '把每一道题当作一次对话，和知识交朋友。',
  '今天多练一题，明天少一分焦虑。',
  '不怕慢，只怕站。',
  '错题不是失败，是下次做对的起点。',
  '你比昨天的自己更强了。',
  '护理的本质是关怀，学习的本质是重复。',
  '量变终会引起质变，继续积累。',
  '专注当下这一题，其他的交给时间。',
  '每一次复盘都在缩短你和目标的距离。',
  '别和别人比，和昨天的自己比。',
  '刷题如磨刀，上了考场才知道锋利。',
  '休息是为了走更远的路，但别停太久。',
  '你选择了这条路，就值得走到底。',
]

function getDailyQuote(): string {
  const today = new Date()
  const dayIndex = (today.getFullYear() * 366 + (today.getMonth() + 1) * 31 + today.getDate()) % DAILY_QUOTES.length
  return DAILY_QUOTES[dayIndex]
}

function isQuestion(question?: PracticeQuestionSummary): question is PracticeQuestionSummary {
  return Boolean(question)
}

export default function PracticePage() {
  const setAuthorized = useAuthStore((state) => state.setAuthorized)
  const { settings, hydrate: hydrateSettings } = useSettingsStore()
  useEffect(() => { hydrateSettings() }, [hydrateSettings])
  const { data: licenseStatus, isLoading: isLicenseLoading } = useQuery({
    queryKey: ['licenseStatus'],
    queryFn: getLicenseStatus,
    staleTime: 30 * 1000,
  })
  const { data: rawData, refetch, isRefetching, isError } = useQuery({
    queryKey: ['practiceHome'],
    queryFn: getPracticeHomeOverview,
    initialData: getLocalPracticeHomeOverview,
  })
  const data = rawData || getLocalPracticeHomeOverview()
  const { data: homeConfig } = useQuery({
    queryKey: ['homeConfig'],
    queryFn: getHomeConfig,
    staleTime: 5 * 60 * 1000,
  })

  useDidShow(() => {
    refetch()
  })

  useEffect(() => {
    if (!licenseStatus?.authorized) return
    const tokenCode = licenseStatus.authorization?.licenseToken?.code
    if (tokenCode) setAuthorized(tokenCode, licenseStatus.authorization?.expiresAt)
  }, [licenseStatus, setAuthorized])

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
  const hasPracticeQuestion = Boolean(continueQuestionId)
  const recommendedQuestions = (data.recommendedQuestions?.length ? data.recommendedQuestions : [data.dailyQuestion])
    .filter(isQuestion)
    .filter((question, index, list) => list.findIndex((item) => item?.id === question?.id) === index)
    .slice(0, 4)

  const dailyGoal = settings.dailyGoal || 20
  const dailyDone = progress?.done || 0

  const weakChapter = (() => {
    if (!data.recentMistakes?.length) return null
    const chapters: Record<string, number> = {}
    data.recentMistakes.forEach((m) => {
      const ch = m.chapter || '未分类'
      chapters[ch] = (chapters[ch] || 0) + (m.wrongCount || 1)
    })
    const sorted = Object.entries(chapters).sort((a, b) => b[1] - a[1])
    return sorted[0] ? { name: sorted[0][0], count: sorted[0][1] } : null
  })()

  const examCountdown = (() => {
    if (settings.examDate) {
      const target = new Date(settings.examDate).getTime()
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const days = Math.ceil((target - today.getTime()) / (1000 * 60 * 60 * 24))
      return days > 0 ? days : 0
    }
    return homeConfig?.examCountdown ?? 45
  })()
  const dailyQuote = homeConfig?.dailyQuote || getDailyQuote()
  const noticeText = homeConfig?.notice || ''
  const [mistakeOpen, setMistakeOpen] = useState(false)
  const [reviewCount, setReviewCount] = useState(0)

  const remoteAuthorization = data.authorization
  const licenseAuthorization = licenseStatus
    ? { status: licenseStatus.authorized ? 'authorized' as const : 'unauthorized' as const, reason: licenseStatus.reason }
    : null
  const authorized = isAuthorized(remoteAuthorization) || isAuthorized(licenseAuthorization)
  const checkingAuthorization = !authorized && isLicenseLoading && !isRefetching

  useEffect(() => {
    if (authorized) getReviewToday().then((r) => { if (r) setReviewCount(r.count) })
  }, [authorized])

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
        <View className={styles.decoBlob1} />
        <View className={styles.decoBlob2} />
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
        <View className={styles.decoBlob1} />
        <View className={styles.decoBlob2} />
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
      <View className={styles.decoBlob1} />
      <View className={styles.decoBlob2} />
      <View className={styles.decoBlob3} />
      <View className={styles.hero}>
        <Text className={styles.brandText}>专转本医护大类</Text>
        {noticeText ? (
          <View className={styles.noticeBar}>
            <Text className={styles.noticeText}>📢 {noticeText}</Text>
          </View>
        ) : (
          <Text className={styles.title}>今日练习</Text>
        )}
        <Text className={styles.statsInline}>🎯 {dailyDone}/{dailyGoal} 今日目标 · 🔥 连续 {data.weeklyCompletedCount || 0} 天</Text>
      </View>

      <View className={styles.capsuleRow}>
        <View className={styles.capsule}>
          <Text className={styles.capsuleValue}>{data.weeklyCompletedCount || 0}</Text>
          <Text className={styles.capsuleUnit}> 天</Text>
          <Text className={styles.capsuleLabel}>坚持</Text>
        </View>
        <View className={styles.capsule}>
          <Text className={styles.capsuleValue}>{Math.round((progress?.done || 0) / Math.max(progress?.total || 1, 1) * 100)}</Text>
          <Text className={styles.capsuleUnit}>%</Text>
          <Text className={styles.capsuleLabel}>正确率</Text>
        </View>
        <View className={styles.capsule}>
          <Text className={styles.capsuleValueAccent}>{examCountdown}</Text>
          <Text className={styles.capsuleUnit}> 天</Text>
          <Text className={styles.capsuleLabel}>倒计时</Text>
        </View>
      </View>

      <View className={styles.quoteBar}>
        <Text className={styles.quoteText}>{dailyQuote}</Text>
      </View>

      {showAuthBanner && (
        <View
          className={cx(styles.authBanner, isExpired ? styles.authBannerDanger : styles.authBannerWarning)}
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

      {hasPracticeQuestion ? (
        <View className={styles.heroCard} onTap={() => goQuestion(continueQuestionId)}>
          <View className={styles.heroTopRow}>
            <Text className={styles.heroLabel}>📖 继续练习</Text>
            <Text className={styles.heroPercent}>{percent}%</Text>
          </View>
          <Text className={styles.heroTitle}>
            {data.continueQuestion?.title || data.dailyQuestion?.title || '继续今日练习'}
          </Text>
          <Text className={styles.heroMeta}>
            {data.continueQuestion?.chapter || data.dailyQuestion?.chapter || '医护大类'} · 上次停留
          </Text>
          <View className={styles.progressTrack}>
            <View className={styles.progressFill} style={{ width: `${percent}%` }} />
          </View>
          <View className={styles.progressFoot}>
            <Text className={styles.progressText}>已练 {progress?.done || 0} / {progress?.total || 0}</Text>
            <Text className={styles.heroAction}>继续 →</Text>
          </View>
        </View>
      ) : (
        <View className={styles.emptyCard}>
          <Text className={styles.emptyTitle}>{isError ? '练习首页加载失败' : '暂无可练习题目'}</Text>
          <Text className={styles.emptyText}>{isError ? '请下拉刷新，或稍后重试' : '当前账号已授权，但后端没有返回已发布题目。请确认后台题目状态为已发布。'}</Text>
          <View className={styles.emptyButton} onTap={goQuestionBank}>
            <Text className={styles.emptyButtonText}>去题库</Text>
          </View>
        </View>
      )}

      {reviewCount > 0 && (
        <View className={styles.weakRow} onTap={() => Taro.navigateTo({ url: '/pages/question-bank-module/index?moduleCode=all&moduleName=%E9%94%99%E9%A2%98%E5%A4%8D%E5%88%B7' })}>
          <Text className={styles.weakText}>📝 今天建议复刷 {reviewCount} 道错题</Text>
          <Text className={styles.weakCta}>去复刷</Text>
        </View>
      )}

      {weakChapter && (
        <View className={styles.weakRow} onTap={goQuestionBank}>
          <Text className={styles.weakText}>⚡「{weakChapter.name}」近期错 {weakChapter.count} 题</Text>
          <Text className={styles.weakCta}>去练习</Text>
        </View>
      )}

      <View className={styles.sectionHeader}>
        <Text className={styles.sectionTitle}>今日推荐</Text>
        <Text className={styles.sectionMeta}>{recommendedQuestions.length || 0} 题</Text>
      </View>
      {recommendedQuestions.length > 0 ? (
        <View className={styles.recommendGrid}>
          {recommendedQuestions.map((question, index) => (
            <View className={styles.recommendCard} key={question.id} onTap={() => goQuestion(question.id)}>
              <View className={styles.recommendIndex}>
                <Text className={styles.recommendIndexText}>{index + 1}</Text>
              </View>
              <Text className={styles.recommendTitle}>{question.title}</Text>
              <Text className={styles.recommendMeta}>{question.chapter || '医护基础'} · {question.difficultyText || '基础'}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View className={styles.emptyCard}>
          <Text className={styles.emptyTitle}>{isError ? '题目加载失败' : '今日推荐同步中'}</Text>
          <Text className={styles.emptyText}>{isError ? '请下拉刷新' : '可先进入题库按章节练习'}</Text>
          <View className={styles.emptyButton} onTap={goQuestionBank}>
            <Text className={styles.emptyButtonText}>去题库</Text>
          </View>
        </View>
      )}

      {data.recentMistakes?.length > 0 && (
        <View className={styles.mistakeSection}>
          <View className={styles.sectionHeader} onTap={() => setMistakeOpen(!mistakeOpen)}>
            <Text className={styles.sectionTitle}>📝 近期错题</Text>
            <Text className={styles.sectionMeta}>{mistakeOpen ? '收起' : `共 ${data.recentMistakes.length} 题 >`}</Text>
          </View>
          {mistakeOpen && (
            <View className={styles.mistakeList}>
              {data.recentMistakes.slice(0, 5).map((item) => (
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
          )}
        </View>
      )}
    </View>
  )
}
