import { Image, Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { activateLicense, getProfileOverview, isAuthorized, loginWithWechatProfile } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
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
    Taro.switchTab({ url: '/pages/practice/index' })
  }

  function goFavorites() {
    Taro.switchTab({ url: '/pages/practice/index' })
  }

  async function handleWechatProfileLogin() {
    if (loginSubmitting) return
    setLoginSubmitting(true)
    try {
      await loginWithWechatProfile()
      Taro.showToast({ title: '已同步微信账号', icon: 'success' })
      refetch()
    } catch {
      Taro.showToast({ title: '未完成授权，可稍后再试', icon: 'none' })
    } finally {
      setLoginSubmitting(false)
    }
  }

  return (
    <View className={styles.page}>
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
          <View className={`${styles.statusPill} ${styles[`pill_${status.tone}`]}`}>
            <View className={styles.statusDot} />
            <Text className={styles.statusText}>{status.text}</Text>
          </View>
        </View>
      </View>

      {!authorized && (
        <View className={styles.loginCard}>
          <View className={styles.loginTextBlock}>
            <Text className={styles.loginTitle}>同步当前微信账号</Text>
            <Text className={styles.loginDesc}>授权头像昵称后，后台台账可识别你的真机 openId，发码与激活会更稳定。</Text>
          </View>
          <View className={`${styles.loginBtn} ${loginSubmitting ? styles.loginBtnDisabled : ''}`} onTap={handleWechatProfileLogin}>
            <Text className={styles.loginBtnText}>{loginSubmitting ? '同步中' : '微信授权'}</Text>
          </View>
        </View>
      )}

      <View className={styles.licenseCard}>
        <View className={styles.licenseHeader}>
          <Text className={styles.licenseLabel}>学习通行码</Text>
          <View className={styles.copyBtn} onTap={handleCopy}>
            <Text className={styles.copyText}>复制</Text>
          </View>
        </View>

        <Text className={styles.licenseCode}>{maskToken(tokenCode)}</Text>

        <View className={styles.licenseMeta}>
          <View className={styles.metaCol}>
            <Text className={styles.metaLabel}>有效期</Text>
            <Text className={styles.metaValue}>{expiresText || '激活后自动生成'}</Text>
          </View>
          {daysLeft != null && daysLeft > 0 && (
            <View className={styles.metaCol}>
              <Text className={styles.metaLabel}>剩余</Text>
              <Text className={`${styles.metaValue} ${daysLeft <= 15 ? styles.metaWarning : ''}`}>
                {daysLeft} 天
              </Text>
            </View>
          )}
        </View>

        {daysLeft != null && daysLeft <= 15 && daysLeft > 0 && (
          <View className={styles.warningBanner}>
            <Text className={styles.warningText}>通行码即将到期，请提前联系发放方更换</Text>
          </View>
        )}

        <View className={styles.scopeBlock}>
          <Text className={styles.scopeLabel}>授权资源</Text>
          <Text className={styles.scopeText}>{scopeText}</Text>
          <Text className={styles.bindTip}>已绑定当前微信账号 不支持多账号共用</Text>
        </View>

        <View className={styles.licenseActions}>
          <View className={styles.replaceBtn} onTap={openReplace}>
            <Text className={styles.replaceText}>更换通行码</Text>
          </View>
        </View>
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
          <Text className={styles.lockStatsText}>累计练习、错题和收藏会在绑定通行码后按当前微信账号展示。</Text>
        </View>
      )}

      <View className={styles.menuCard}>
        <View className={styles.menuItem} onTap={goMistakes}>
          <Text className={styles.menuTitle}>我的错题</Text>
          <Text className={styles.menuArrow}>{'>'}</Text>
        </View>
        <View className={styles.menuItem} onTap={goFavorites}>
          <Text className={styles.menuTitle}>我的收藏</Text>
          <Text className={styles.menuArrow}>{'>'}</Text>
        </View>
      </View>

      <Text className={styles.footerTip}>本小程序仅提供学习辅助，不提供报名或购买服务</Text>

      {replaceVisible && (
        <View className={styles.modalMask} onTap={closeReplace}>
          <View className={styles.modalCard} onTap={(e) => e.stopPropagation()}>
            <Text className={styles.modalTitle}>更换通行码</Text>
            <Text className={styles.modalDesc}>输入新的通行码，校验通过后立即替换当前授权。新码必须绑定当前微信账号。</Text>

            <View className={`${styles.modalInputWrap} ${replaceError ? styles.modalInputWrapError : ''}`}>
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
                className={`${styles.modalConfirm} ${CODE_PATTERN.test(newCode) && !replaceSubmitting ? '' : styles.modalConfirmDisabled}`}
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
