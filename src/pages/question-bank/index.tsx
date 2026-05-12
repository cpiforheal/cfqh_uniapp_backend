import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { getLicenseStatus, getLocalQuestionBankOverview, getQuestionBankOverview, isAuthorized } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
import type { QuestionBankOverview } from '@/types/study'
import type { LicenseStatusResult } from '@/services/nursing'
import { cx } from '@/utils/classNames'
import styles from './index.module.scss'

function progressWidth(rate: number) {
  return `${Math.max(0, Math.min(rate, 100))}%`
}

export default function QuestionBankPage() {
  const setAuthorized = useAuthStore((state) => state.setAuthorized)
  const [overview, setOverview] = useState<QuestionBankOverview>(() => getLocalQuestionBankOverview())
  const [isCatalogLoading, setIsCatalogLoading] = useState(false)
  const [catalogLoadError, setCatalogLoadError] = useState('')
  const { data: licenseStatus, isLoading: isLicenseLoading, refetch: refetchLicenseStatus } = useQuery({
    queryKey: ['licenseStatus'],
    queryFn: getLicenseStatus,
  })
  const licenseAuthorization = licenseStatus
    ? { status: licenseStatus.authorized ? 'authorized' as const : 'unauthorized' as const, reason: licenseStatus.reason }
    : null
  const licenseAuthorized = isAuthorized(licenseAuthorization)

  const loadQuestionBank = useCallback(async (status?: LicenseStatusResult | null) => {
    let effectiveStatus = status
    setIsCatalogLoading(true)
    setCatalogLoadError('')
    try {
      if (!effectiveStatus) effectiveStatus = await getLicenseStatus()
      const nextOverview = await getQuestionBankOverview(effectiveStatus)
      setOverview(nextOverview)
      const tokenCode = effectiveStatus.authorization?.licenseToken?.code
      if (effectiveStatus.authorized && tokenCode) setAuthorized(tokenCode, effectiveStatus.authorization?.expiresAt)
    } catch (error) {
      console.warn('question bank catalog load failed', error)
      setCatalogLoadError('request_failed')
      if (!effectiveStatus?.authorized) setOverview(getLocalQuestionBankOverview())
    } finally {
      setIsCatalogLoading(false)
    }
  }, [setAuthorized])

  const catalog = Array.isArray(overview.catalog) ? overview.catalog : []

  const authorized = licenseAuthorized
  const checkingAuthorization = !authorized && (isLicenseLoading || isCatalogLoading)
  const catalogLooksLocked = authorized && catalog.length > 0 && catalog.every((item) => item.locked || (item.difficultyLabel === '待解锁' && (item.totalQuestions || 0) === 0))
  const catalogFailed = authorized && !isCatalogLoading && (Boolean(catalogLoadError) || catalog.length === 0 || catalogLooksLocked)
  const totalModules = catalog.length
  const totalQuestions = catalog.reduce((sum, item) => sum + (authorized ? item.totalQuestions || 0 : item.subChapterCount || 0), 0)
  const completedQuestions = catalog.reduce((sum, item) => sum + (authorized ? item.completedQuestions || 0 : 0), 0)

  useDidShow(() => {
    refetchLicenseStatus().then((result) => {
      loadQuestionBank(result.data)
    })
  })

  usePullDownRefresh(async () => {
    const result = await refetchLicenseStatus()
    await loadQuestionBank(result.data)
    Taro.stopPullDownRefresh()
  })

  useEffect(() => {
    if (!isCatalogLoading) {
      Taro.stopPullDownRefresh()
    }
  }, [isCatalogLoading])

  useEffect(() => {
    if (!licenseStatus) return
    if (licenseStatus.authorized) {
      const tokenCode = licenseStatus.authorization?.licenseToken?.code
      if (tokenCode) setAuthorized(tokenCode, licenseStatus.authorization?.expiresAt)
    }
    loadQuestionBank(licenseStatus)
  }, [licenseStatus, loadQuestionBank, setAuthorized])

  function goActivate() {
    Taro.navigateTo({ url: '/pages/activate/index' })
  }

  function goChapter(moduleCode?: string, moduleName?: string) {
    if (!authorized) {
      goActivate()
      return
    }
    if (!moduleCode) {
      Taro.showToast({ title: '模块信息缺失', icon: 'none' })
      return
    }
    Taro.navigateTo({
      url: `/pages/question-bank-module/index?moduleCode=${moduleCode}&moduleName=${encodeURIComponent(moduleName || moduleCode)}`,
    })
  }

  return (
    <View className={styles.page}>
      <View className={styles.hero}>
        <Text className={styles.brandText}>专转本医护大类</Text>
        <Text className={styles.title}>题库目录</Text>
        <Text className={styles.desc}>
          {authorized
            ? '按课程模块进入章节练习，题目、解析、错题记录与首页进度保持同步。'
            : '当前仅展示课程框架，输入学习通行码后解锁章节题目、答案解析与练习记录。'}
        </Text>
      </View>

      <View className={styles.summaryGrid}>
        <View className={styles.summaryCard}>
          <Text className={styles.summaryValue}>{totalModules}</Text>
          <Text className={styles.summaryLabel}>课程模块</Text>
        </View>
        <View className={styles.summaryCard}>
          <Text className={styles.summaryValue}>{totalQuestions}</Text>
          <Text className={styles.summaryLabel}>{authorized ? '可练题目' : '小章节'}</Text>
        </View>
        <View className={styles.summaryCard}>
          <Text className={styles.summaryValue}>{completedQuestions}</Text>
          <Text className={styles.summaryLabel}>已完成</Text>
        </View>
      </View>

      {checkingAuthorization && (
        <View className={styles.activateBanner}>
          <View className={styles.bannerMain}>
            <Text className={styles.bannerTitle}>正在确认授权</Text>
            <Text className={styles.bannerText}>正在同步本机通行码和后端授权状态，请稍候。</Text>
          </View>
        </View>
      )}

      {!authorized && !checkingAuthorization && (
        <View className={styles.activateBanner}>
          <View className={styles.bannerMain}>
            <Text className={styles.bannerTitle}>题库内容已锁定</Text>
            <Text className={styles.bannerText}>激活后查看真实题目、选项、解析和个人进度。</Text>
          </View>
          <View className={styles.activateButton} onTap={goActivate}>
            <Text className={styles.activateButtonText}>立即激活</Text>
          </View>
        </View>
      )}

      {catalogLooksLocked ? (
        <View className={styles.loadingCard}>
          <Text className={styles.loadingTitle}>{isCatalogLoading ? '正在加载完整题库' : '题库数据异常'}</Text>
          <Text className={styles.loadingText}>
            {isCatalogLoading
              ? '授权已确认，正在刷新章节目录和题量数据。'
              : '授权已确认，但后端返回的目录为空或全部锁定。可能原因：openId 传递不一致、后端题目未发布、或数据库连接异常。'}
          </Text>
          {!isCatalogLoading && (
            <View className={styles.retryButton} onTap={() => loadQuestionBank()}>
              <Text className={styles.retryButtonText}>重新加载</Text>
            </View>
          )}
        </View>
      ) : catalogFailed ? (
        <View className={styles.loadingCard}>
          <Text className={styles.loadingTitle}>题库目录加载失败</Text>
          <Text className={styles.loadingText}>授权已生效，但暂时没有拿到真实题库目录。请检查后端服务后重试。</Text>
          <View className={styles.retryButton} onTap={() => loadQuestionBank()}>
            <Text className={styles.retryButtonText}>重新加载</Text>
          </View>
        </View>
      ) : (
        <View className={styles.list}>
          {catalog.map((item) => (
            <View key={item.moduleCode || item.chapter} className={styles.catalogCard} onTap={() => goChapter(item.moduleCode, item.moduleName || item.chapter)}>
              <View className={styles.cardHeader}>
                <View className={styles.iconBox}>
                  <Text className={styles.iconText}>{item.iconText}</Text>
                </View>
                <View className={styles.chapterMain}>
                  <Text className={styles.chapterTitle}>{item.moduleName || item.chapter}</Text>
                  <Text className={styles.chapterDesc}>
                    {authorized
                      ? `小章节 ${item.subChapterCount || 0} 个 · 难度 ${item.difficultyLabel}`
                      : `包含 ${item.subChapterCount || 0} 个小章节，激活后展开练习`}
                  </Text>
                </View>
                <Text className={authorized ? styles.arrow : styles.lockText}>{authorized ? '>' : '锁定'}</Text>
              </View>
              <View className={styles.metaRow}>
                <Text className={styles.metaText}>{authorized ? `题量 ${item.totalQuestions} 题` : `小章节 ${item.subChapterCount || 0} 个`}</Text>
                <Text className={cx(styles.difficultyTag, item.difficultyLabel === '较难' && styles.hardTag)}>难度 {item.difficultyLabel}</Text>
              </View>
              <View className={styles.progressRow}>
                <Text className={styles.progressLabel}>
                  {authorized ? `已完成 ${item.completedQuestions} 题（${item.completionRate}%） · 小章节 ${item.subChapterCount || 0}` : '激活后查看章节题目、答案解析和练习进度'}
                </Text>
                <View className={styles.progressTrack}>
                  <View className={styles.progressFill} style={{ width: progressWidth(authorized ? item.completionRate : 0) }} />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {!authorized && !checkingAuthorization && (
        <View className={styles.bottomPrompt}>
          <Text className={styles.bottomText}>输入学习通行码，解锁全部章节与解析</Text>
          <View className={styles.bottomButton} onTap={goActivate}>
            <Text className={styles.bottomButtonText}>立即激活</Text>
          </View>
        </View>
      )}
    </View>
  )
}
