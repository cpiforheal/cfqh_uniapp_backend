import { Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { activateLicense, getLicenseStatus, getQuestionBankOverview } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
import { cx } from '@/utils/classNames'
import styles from './index.module.scss'

const CODE_LENGTH = 12
const COMPACT_CODE_LENGTH = 11
const CODE_PATTERN = /^(?:[A-Z0-9]{8}|NUR-[A-Z0-9]{8})$/
const ALNUM_PATTERN = /[A-Z0-9]/g

type ActivateLicenseStatus = {
  authorized: boolean
  authorization?: { expiresAt?: string; licenseToken?: { code?: string } }
}

function normalizeCode(value: string) {
  const compactValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const compact = (compactValue.match(/NUR[A-Z0-9]{8}/)?.[0] || compactValue).slice(0, 11)
  if (compact.startsWith('NUR') && compact.length > 3) {
    return `NUR-${compact.slice(3, 11)}`
  }
  return compact.slice(0, 8)
}

function formatDisplay(value: string) {
  if (value.startsWith('NUR-')) return value.length <= 8 ? value : `${value.slice(0, 8)} ${value.slice(8)}`
  if (value.length <= 4) return value
  return `${value.slice(0, 4)} ${value.slice(4)}`
}

export default function ActivatePage() {
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorText, setErrorText] = useState('')
  const setAuthorized = useAuthStore((state) => state.setAuthorized)
  const { data: licenseStatus, refetch: refetchLicenseStatus } = useQuery({
    queryKey: ['licenseStatus'],
    queryFn: getLicenseStatus,
  })

  async function refreshAuthorizedCache(status?: ActivateLicenseStatus | null) {
    if (!status?.authorized) return
    queryClient.setQueryData(['licenseStatus'], status)
    await queryClient.fetchQuery({
      queryKey: ['questionBank', 'authorized'],
      queryFn: () => getQuestionBankOverview(status),
      staleTime: 0,
    })
    queryClient.invalidateQueries({ queryKey: ['practiceHome'] })
    queryClient.invalidateQueries({ queryKey: ['questionBank'] })
    queryClient.invalidateQueries({ queryKey: ['profileOverview'] })
    queryClient.invalidateQueries({ queryKey: ['moduleQuestions'] })
    queryClient.invalidateQueries({ queryKey: ['questionDetail'] })
  }

  useEffect(() => {
    if (!licenseStatus?.authorized) return
    const tokenCode = licenseStatus.authorization?.licenseToken?.code
    if (tokenCode) setAuthorized(tokenCode, licenseStatus.authorization?.expiresAt)
    void refreshAuthorizedCache(licenseStatus)
  }, [licenseStatus, setAuthorized])

  function handleInput(value: string) {
    setErrorText('')
    setCode(normalizeCode(value))
  }

  async function handlePaste() {
    try {
      const res = await Taro.getClipboardData()
      if (res?.data) handleInput(res.data)
    } catch {
      // ignore
    }
  }

  async function handleScan() {
    try {
      const res = await Taro.scanCode({ onlyFromCamera: false })
      const raw = res?.result || ''
      const matched = raw.toUpperCase().match(ALNUM_PATTERN)
      const joined = matched ? matched.join('') : ''
      const compact = joined.match(/NUR[A-Z0-9]{8}/)?.[0] || joined
      if (compact.length >= 8) {
        handleInput(compact.slice(0, compact.startsWith('NUR') ? COMPACT_CODE_LENGTH : 8))
      } else {
        setErrorText('未识别到有效通行码，请手动输入')
      }
    } catch {
      // 用户取消扫码
    }
  }

  async function handleActivate() {
    const tokenCode = code.trim()
    if (!tokenCode) {
      setErrorText('请输入学习通行码')
      return
    }
    if (!CODE_PATTERN.test(tokenCode)) {
      setErrorText('通行码为 8 位字符，或 NUR- 开头的完整授权码')
      return
    }

    setSubmitting(true)
    const result = await activateLicense(tokenCode)
    setSubmitting(false)

    if (!result?.authorized) {
      const latestStatus = await refetchLicenseStatus()
      if (latestStatus.data?.authorized) {
        const activeCode = latestStatus.data.authorization?.licenseToken?.code || tokenCode
        setAuthorized(activeCode, latestStatus.data.authorization?.expiresAt)
        await refreshAuthorizedCache(latestStatus.data)
        Taro.showToast({ title: '账号已激活', icon: 'success' })
        setTimeout(() => {
          Taro.navigateTo({ url: '/pages/sync-profile/index' })
        }, 600)
        return
      }

      const reason = result?.reason
      if (reason === 'expired') {
        setErrorText('该通行码已过期，请联系发放人员更换')
      } else if (reason === 'bound_other_device' || reason === 'bound_to_other_account') {
        setErrorText('该通行码已绑定其他微信账号，无法在本账号使用')
      } else if (reason === 'not_found') {
        setErrorText('未找到对应通行码，请检查字母与数字')
      } else {
        setErrorText('激活失败，请稍后重试')
      }
      return
    }

    const expiresAt = result.authorization?.expiresAt
    setAuthorized(result.authorization?.licenseToken?.code || tokenCode, expiresAt)
    await refreshAuthorizedCache(result)
    Taro.showToast({ title: '激活成功', icon: 'success' })
    setTimeout(() => {
      Taro.navigateTo({ url: '/pages/sync-profile/index' })
    }, 600)
  }

  const canSubmit = CODE_PATTERN.test(code) && !submitting
  const displayValue = formatDisplay(code)
  const targetLength = code.startsWith('NUR-') ? 12 : 8
  const alreadyAuthorized = Boolean(licenseStatus?.authorized)
  const currentTokenCode = licenseStatus?.authorization?.licenseToken?.code

  return (
    <View className={styles.page}>
      <View className={styles.hero}>
        <View className={styles.brandBadge}>
          <Text className={styles.brandText}>医护自学辅助</Text>
        </View>
        <Text className={styles.title}>输入通行码</Text>
        <Text className={styles.desc}>通行码由老师统一下发，激活后绑定当前微信账号。</Text>
      </View>

      <View className={styles.formCard}>
        {alreadyAuthorized && (
          <View className={styles.loginCard}>
            <View className={styles.loginTextBlock}>
              <Text className={styles.loginTitle}>当前账号已激活</Text>
              <Text className={styles.loginDesc}>通行码 {currentTokenCode || '—'}，可直接进入练习。</Text>
            </View>
            <View className={styles.loginBtn} onTap={() => Taro.switchTab({ url: '/pages/practice/index' })}>
              <Text className={styles.loginBtnText}>去练习</Text>
            </View>
          </View>
        )}

        <View className={styles.formHeader}>
          <Text className={styles.label}>学习通行码</Text>
          <View className={styles.formActions}>
            <View className={styles.miniBtn} onTap={handleScan}>
              <Text className={styles.miniBtnText}>扫码</Text>
            </View>
            <View className={styles.miniBtn} onTap={handlePaste}>
              <Text className={styles.miniBtnText}>粘贴</Text>
            </View>
          </View>
        </View>

        <View className={cx(styles.inputWrap, Boolean(errorText) && styles.inputWrapError)}>
          <Input
            className={styles.input}
            placeholder='8 位英文与数字'
            placeholderClass={styles.placeholder}
            value={displayValue}
            maxlength={CODE_LENGTH + 1}
            type='text'
            onInput={(event) => handleInput(event.detail.value)}
          />
          <Text className={styles.counter}>{code.replace(/\s/g, '').length}/{targetLength}</Text>
        </View>

        {errorText ? (
          <Text className={styles.errorText}>{errorText}</Text>
        ) : (
          <Text className={styles.helperText}>字母自动转大写，空格与符号自动忽略</Text>
        )}

        <View
          className={cx(styles.button, !canSubmit && styles.buttonDisabled)}
          onTap={canSubmit ? handleActivate : undefined}
        >
          {submitting ? '正在激活...' : '立即激活'}
        </View>

        <View className={styles.sourceHint}>
          <Text className={styles.sourceTitle}>没有通行码？</Text>
          <Text className={styles.sourceDesc}>通行码由老师通过课程群下发，本小程序不提供购买。</Text>
        </View>
      </View>
    </View>
  )
}
