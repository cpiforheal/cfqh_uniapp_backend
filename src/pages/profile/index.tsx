import { Image, Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { activateLicense, getProfileOverview, isAuthorized, loginWithWechatProfile } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
import { cx } from '@/utils/classNames'
import styles from './index.module.scss'

const CODE_PATTERN = /^(?:[A-Z0-9]{8}|NUR-[A-Z0-9]{8})$/
const CODE_LENGTH = 12

function normalizeCode(value: string) {
  const compactValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const compact = (compactValue.match(/NUR[A-Z0-9]{8}/)?.[0] || compactValue).slice(0, 11)
  if (compact.startsWith('NUR') && compact.length > 3) {
    return `NUR-${compact.slice(3, 11)}`
  }
  return compact.slice(0, 8)
}

function maskToken(code?: string) {
  if (!code) return '未激活'
  const clean = code.replace(/\s|-/g, '').toUpperCase()
  if (clean.length <= 4) return clean
  const head = clean.slice(0, 4)
  const tail = clean.slice(-2)
  return `${head} **** ${tail}`
}

function parseDaysLeft(expiresText?: string): number | null {
  if (!expiresText) return null
  const match = expiresText.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (!match) return null
  const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today.getTime()) / (1000 * 60 * 60 * 24))
}

function statusDisplay(status?: string, daysLeft?: number | null) {
  if (status !== 'authorized') return { text: '未激活', tone: 'danger' as const }
  if (daysLeft != null && daysLeft <= 0) return { text: '已到期', tone: 'danger' as const }
  if (daysLeft != null && daysLeft <= 15) return { text: '即将到期', tone: 'warning' as const }
  return { text: '已激活', tone: 'success' as const }
}

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const tokenCodeFromStore = useAuthStore((state) => state.tokenCode)
  const setAuthorized = useAuthStore((state) => state.setAuthorized)

  const [replaceVisible, setReplaceVisible] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [replaceSubmitting, setReplaceSubmitting] = useState(false)
  const [replaceError, setReplaceError] = useState('')
  const [loginSubmitting, setLoginSubmitting] = useState(false)

  const { data, refetch, isRefetching } = useQuery({
    queryKey: ['profileOverview'],
    queryFn: getProfileOverview,
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

  useEffect(() => {
    if (!data?.authorization || !isAuthorized(data.authorization)) return
    if (data.authorization.tokenCode) setAuthorized(data.authorization.tokenCode, undefined)
  }, [data?.authorization, setAuthorized])

  const remoteAuthorization = data?.authorization
  const displayAuthorization = remoteAuthorization

  const expiresText = displayAuthorization?.expiresText
  const daysLeft = useMemo(() => parseDaysLeft(expiresText), [expiresText])
  const status = statusDisplay(displayAuthorization?.status, daysLeft)
  const authorized = isAuthorized(displayAuthorization)
  const tokenCode = authorized ? displayAuthorization?.tokenCode || tokenCodeFromStore : ''
  const scopeText = displayAuthorization?.resourceScopeText || '医护题库、解析、案例材料、公开讲解'

  async function handleCopy() {
    if (!tokenCode) {
      Taro.showToast({ title: '暂无可复制的通行码', icon: 'none' })
      return
    }
    await Taro.setClipboardData({ data: tokenCode })
  }

  function openReplace() {
    setNewCode('')
    setReplaceError('')
    setReplaceVisible(true)
  }

  function closeReplace() {
    if (replaceSubmitting) return
    setReplaceVisible(false)
  }

  async function submitReplace() {
    const trimmed = newCode.trim()
    if (!CODE_PATTERN.test(trimmed)) {
      setReplaceError('新通行码为 8 位字符，或 NUR- 开头的完整授权码')
      return
    }
    if (trimmed === tokenCode) {
      setReplaceError('新通行码与当前相同')
      return
    }
    setReplaceSubmitting(true)
    const result = await activateLicense(trimmed)
    setReplaceSubmitting(false)

    if (!result?.authorized) {
      const reason = result?.reason
      if (reason === 'expired') setReplaceError('该通行码已过期')
      else if (reason === 'bound_other_device' || reason === 'bound_to_other_account') setReplaceError('该通行码已绑定其他微信账号')
      else if (reason === 'not_found') setReplaceError('未找到对应通行码')
      else setReplaceError('更换失败，请稍后重试')
      return
    }

    setAuthorized(result.authorization?.licenseToken?.code || trimmed, result.authorization?.expiresAt)
    queryClient.setQueryData(['licenseStatus'], result)
    queryClient.invalidateQueries({ queryKey: ['practiceHome'] })
    queryClient.invalidateQueries({ queryKey: ['questionBank'] })
    queryClient.invalidateQueries({ queryKey: ['profileOverview'] })
    queryClient.invalidateQueries({ queryKey: ['moduleQuestions'] })
    queryClient.invalidateQueries({ queryKey: ['questionDetail'] })
    queryClient.invalidateQueries({ queryKey: ['videoLessons'] })
    setReplaceVisible(false)
    Taro.showToast({ title: '已更换通行码', icon: 'success' })
    refetch()
  }

  function goMistakes() {
    Taro.navigateTo({ url: '/pages/question-bank-module/index?moduleCode=all&moduleName=%E6%88%91%E7%9A%84%E9%94%99%E9%A2%98' })
  }

  function goFavorites() {
    Taro.navigateTo({ url: '/pages/question-bank-module/index?moduleCode=all&moduleName=%E6%88%91%E7%9A%84%E6%94%B6%E8%97%8F' })
  }

  async function handleWechatProfileLogin() {
    if (loginSubmitting) return
    setLoginSubmitting(true)
    try {
      const result = await loginWithWechatProfile()
      Taro.showToast({ title: result.cancelled ? '已保持当前账号' : '已同步微信账号', icon: result.cancelled ? 'none' : 'success' })
      refetch()
    } catch {
      Taro.showToast({ title: '同步失败，请检查网络', icon: 'none' })
    } finally {
      setLoginSubmitting(false)
    }
  }

  return (
    <View className={styles.page}>
      <View className={styles.decoBlob1} />
      <View className={styles.decoBlob2} />
      <View className={styles.topBar}>
        <View className={styles.avatar}>
          {data?.avatarUrl ? (
            <Image className={styles.avatarImage} src={data.avatarUrl} mode="aspectFill" />
          ) : (
            <Text className={styles.avatarText}>{data?.avatarText || '护'}</Text>
          )}
        </View>
        <View className={styles.userInfo}>
          <Text className={styles.nickname}>{data?.nickname || '医护同学'}</Text>
          <View className={cx(styles.statusPill, styles[`pill_${status.tone}`])}>
            <View className={styles.statusDot} />
            <Text className={styles.statusText}>{status.text}</Text>
          </View>
        </View>
        <View
          className={cx(styles.authBtn, loginSubmitting && styles.authBtnDisabled)}
          onTap={handleWechatProfileLogin}
        >
          <Text className={styles.authBtnText}>{loginSubmitting ? '同步中' : data?.avatarUrl ? '已授权' : '微信授权'}</Text>
        </View>
      </View>

      <View className={styles.licenseCard}>
        <View className={styles.licenseRow}>
          <Text className={styles.licenseCode}>{maskToken(tokenCode)}</Text>
          <Text className={styles.licenseMeta}>
            {daysLeft != null && daysLeft > 0
              ? `${daysLeft} 天后到期`
              : expiresText || '已激活'}
          </Text>
        </View>
        {daysLeft != null && daysLeft <= 15 && daysLeft > 0 && (
          <Text className={styles.warningText}>即将到期，请联系发放方更换</Text>
        )}
      </View>

      {authorized ? (
        <View className={styles.statGrid}>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>{data?.practiceCount ?? 0}</Text>
            <Text className={styles.statLabel}>累计练习</Text>
          </View>
          <View className={styles.statCard} onTap={goMistakes}>
            <Text className={styles.statValue}>{data?.mistakeCount ?? 0}</Text>
            <Text className={styles.statLabel}>错题</Text>
          </View>
          <View className={styles.statCard} onTap={goFavorites}>
            <Text className={styles.statValue}>{data?.favoriteCount ?? 0}</Text>
            <Text className={styles.statLabel}>收藏</Text>
          </View>
        </View>
      ) : (
        <View className={styles.lockStatsCard}>
          <Text className={styles.lockStatsTitle}>练习数据待激活</Text>
          <Text className={styles.lockStatsText}>绑定通行码后展示学习数据。</Text>
        </View>
      )}

      <View className={styles.sectionTitle}>
        <Text className={styles.sectionTitleText}>功能</Text>
      </View>
      <View className={styles.featureGrid}>
        <View className={styles.featureCard} onTap={goMistakes}>
          <View className={styles.featureIcon}>
            <Text className={styles.featureIconText}>错</Text>
          </View>
          <Text className={styles.featureLabel}>我的错题</Text>
        </View>
        <View className={styles.featureCard} onTap={goFavorites}>
          <View className={styles.featureIcon}>
            <Text className={styles.featureIconText}>收</Text>
          </View>
          <Text className={styles.featureLabel}>我的收藏</Text>
        </View>
        <View className={styles.featureCard} onTap={openReplace}>
          <View className={styles.featureIcon}>
            <Text className={styles.featureIconText}>换</Text>
          </View>
          <Text className={styles.featureLabel}>更换通行码</Text>
        </View>
        <View className={styles.featureCard} onTap={() => Taro.navigateTo({ url: '/pages/ranking/index' })}>
          <View className={styles.featureIcon}>
            <Text className={styles.featureIconText}>榜</Text>
          </View>
          <Text className={styles.featureLabel}>排行榜</Text>
        </View>
        <View className={styles.featureCard} onTap={() => Taro.navigateTo({ url: '/pages/learning-report/index' })}>
          <View className={styles.featureIcon}>
            <Text className={styles.featureIconText}>报</Text>
          </View>
          <Text className={styles.featureLabel}>学习报告</Text>
        </View>
        <View className={styles.featureCard} onTap={() => Taro.navigateTo({ url: '/pages/settings/index' })}>
          <View className={styles.featureIcon}>
            <Text className={styles.featureIconText}>设</Text>
          </View>
          <Text className={styles.featureLabel}>学习设置</Text>
        </View>
        <View className={styles.featureCard} onTap={() => Taro.showModal({ title: '关于', content: '专转本医护大类自学辅助\n仅供学习参考，不提供报名或购买服务。\n通行码由老师统一下发。', showCancel: false })}>
          <View className={styles.featureIcon}>
            <Text className={styles.featureIconText}>关</Text>
          </View>
          <Text className={styles.featureLabel}>关于</Text>
        </View>
      </View>

      <Text className={styles.footerTip}>本小程序仅提供学习辅助，不提供报名或购买服务</Text>

      {replaceVisible && (
        <View className={styles.modalMask} onTap={closeReplace}>
          <View className={styles.modalCard} onTap={(e) => e.stopPropagation()}>
            <Text className={styles.modalTitle}>更换通行码</Text>
            <Text className={styles.modalDesc}>输入新的通行码，校验通过后立即替换当前授权。</Text>

            <View className={cx(styles.modalInputWrap, Boolean(replaceError) && styles.modalInputWrapError)}>
              <Input
                className={styles.modalInput}
                placeholder='8 位码或 NUR-完整授权码'
                placeholderClass={styles.modalPlaceholder}
                value={newCode}
                maxlength={CODE_LENGTH}
                onInput={(event) => {
                  setReplaceError('')
                  setNewCode(normalizeCode(event.detail.value))
                }}
              />
            </View>

            {replaceError ? (
              <Text className={styles.modalError}>{replaceError}</Text>
            ) : (
              <Text className={styles.modalHelper}>原通行码在校验成功前保持有效</Text>
            )}

            <View className={styles.modalActions}>
              <View className={styles.modalCancel} onTap={closeReplace}>
                <Text className={styles.modalCancelText}>取消</Text>
              </View>
              <View
                className={cx(styles.modalConfirm, (!CODE_PATTERN.test(newCode) || replaceSubmitting) && styles.modalConfirmDisabled)}
                onTap={CODE_PATTERN.test(newCode) && !replaceSubmitting ? submitReplace : undefined}
              >
                <Text className={styles.modalConfirmText}>
                  {replaceSubmitting ? '校验中...' : '确认更换'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
