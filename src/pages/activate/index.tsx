import { Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { activateLicense, loginWithWechatProfile } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
import styles from './index.module.scss'

const CODE_LENGTH = 12
const COMPACT_CODE_LENGTH = 11
const CODE_PATTERN = /^(?:[A-Z0-9]{8}|NUR-[A-Z0-9]{8})$/
const ALNUM_PATTERN = /[A-Z0-9]/g

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
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loginSubmitting, setLoginSubmitting] = useState(false)
  const [loginSynced, setLoginSynced] = useState(false)
  const [errorText, setErrorText] = useState('')
  const setAuthorized = useAuthStore((state) => state.setAuthorized)

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
    Taro.showToast({ title: '激活成功', icon: 'success' })
    setTimeout(() => {
      Taro.switchTab({ url: '/pages/practice/index' })
    }, 600)
  }

  async function handleWechatProfileLogin() {
    if (loginSubmitting) return
    setLoginSubmitting(true)
    setErrorText('')
    try {
      await loginWithWechatProfile()
      setLoginSynced(true)
      Taro.showToast({ title: '已同步微信账号', icon: 'success' })
    } catch {
      Taro.showToast({ title: '未完成授权，可稍后再试', icon: 'none' })
    } finally {
      setLoginSubmitting(false)
    }
  }

  const canSubmit = CODE_PATTERN.test(code) && !submitting
  const displayValue = formatDisplay(code)
  const targetLength = code.startsWith('NUR-') ? 12 : 8

  return (
    <View className={styles.page}>
      <View className={styles.hero}>
        <View className={styles.brandBadge}>
          <Text className={styles.brandText}>医护自学辅助</Text>
        </View>
        <Text className={styles.title}>输入通行码 解锁完整题库</Text>
        <Text className={styles.desc}>完成激活后可使用题库练习、解析复盘与公开讲解。通行码绑定当前微信账号，不支持多账号共用。</Text>
      </View>

      <View className={styles.formCard}>
        <View className={styles.loginCard}>
          <View className={styles.loginTextBlock}>
            <Text className={styles.loginTitle}>{loginSynced ? '微信账号已同步' : '先同步微信账号'}</Text>
            <Text className={styles.loginDesc}>激活会绑定当前微信账号，后台台账可据此核验发码与登录记录。</Text>
          </View>
          <View className={`${styles.loginBtn} ${loginSubmitting || loginSynced ? styles.loginBtnMuted : ''}`} onTap={handleWechatProfileLogin}>
            <Text className={styles.loginBtnText}>{loginSubmitting ? '同步中' : loginSynced ? '重新同步' : '微信授权'}</Text>
          </View>
        </View>

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

        <View className={`${styles.inputWrap} ${errorText ? styles.inputWrapError : ''}`}>
          <Input
            className={styles.input}
            placeholder='8 位码或 NUR-完整授权码'
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
          <Text className={styles.helperText}>8 位英文与数字，字母自动转大写，空格与符号自动忽略</Text>
        )}

        <View
          className={`${styles.button} ${canSubmit ? '' : styles.buttonDisabled}`}
          onTap={canSubmit ? handleActivate : undefined}
        >
          {submitting ? '正在激活...' : '立即激活'}
        </View>

        <View className={styles.sourceHint}>
          <Text className={styles.sourceTitle}>没有通行码？</Text>
          <Text className={styles.sourceDesc}>通行码由学习资源发放方统一下发，一般通过课程群或辅导老师获取。本小程序不提供购买或报名。通行码与当前微信账号唯一绑定。</Text>
        </View>
      </View>

      <View className={styles.benefits}>
        <Text className={styles.benefitsTitle}>激活后即可使用</Text>
        <View className={styles.benefitGrid}>
          <View className={styles.benefitCard}>
            <View className={styles.benefitIcon}>题</View>
            <Text className={styles.benefitTitle}>完整题库练习</Text>
            <Text className={styles.benefitDesc}>按章节或随机刷题 巩固医护考点</Text>
          </View>
          <View className={styles.benefitCard}>
            <View className={styles.benefitIcon}>析</View>
            <Text className={styles.benefitTitle}>答题解析复盘</Text>
            <Text className={styles.benefitDesc}>查看逐题解析 理解易混点与记忆提示</Text>
          </View>
          <View className={styles.benefitCard}>
            <View className={styles.benefitIcon}>讲</View>
            <Text className={styles.benefitTitle}>关联公开讲解</Text>
            <Text className={styles.benefitDesc}>配套视频 加深薄弱知识点理解</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
