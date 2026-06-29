import { Button, Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { getProfileOverview, syncProfile } from '@/services/nursing'
import { cx } from '@/utils/classNames'
import styles from './index.module.scss'

type PrivacySetting = {
  needAuthorization?: boolean
  privacyContractName?: string
}

const wxPrivacy = Taro as typeof Taro & {
  getPrivacySetting?: (options: { success?: (res: PrivacySetting) => void; fail?: () => void }) => void
  openPrivacyContract?: (options?: { fail?: () => void }) => void
}

function getPrivacySetting() {
  return new Promise<PrivacySetting>((resolve) => {
    if (!wxPrivacy.getPrivacySetting) {
      resolve({ needAuthorization: false })
      return
    }
    wxPrivacy.getPrivacySetting({
      success: resolve,
      fail: () => resolve({ needAuthorization: false }),
    })
  })
}

export default function SyncProfilePage() {
  const [realName, setRealName] = useState('')
  const [className, setClassName] = useState('')
  const [wechatId, setWechatId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [privacyVisible, setPrivacyVisible] = useState(false)
  const [privacyContractName, setPrivacyContractName] = useState('隐私保护指引')

  useEffect(() => {
    let mounted = true
    getProfileOverview()
      .then((profile) => {
        if (!mounted) return
        setRealName(profile.realName || '')
        setClassName(profile.className || '')
        setWechatId(profile.wechatId || '')
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  async function saveProfile() {
    if (!realName.trim()) {
      Taro.showToast({ title: '请填写姓名', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await syncProfile({ realName: realName.trim(), className: className.trim(), wechatId: wechatId.trim() })
      Taro.showToast({ title: '信息已保存', icon: 'success' })
      setTimeout(() => Taro.switchTab({ url: '/pages/practice/index' }), 600)
    } catch {
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit() {
    const privacy = await getPrivacySetting()
    if (privacy.needAuthorization) {
      setPrivacyContractName(privacy.privacyContractName || '隐私保护指引')
      setPrivacyVisible(true)
      return
    }
    saveProfile()
  }

  function handlePrivacyAgree() {
    setPrivacyVisible(false)
    saveProfile()
  }

  function handleOpenPrivacyContract() {
    if (!wxPrivacy.openPrivacyContract) {
      Taro.showToast({ title: '当前微信版本不支持查看', icon: 'none' })
      return
    }
    wxPrivacy.openPrivacyContract({
      fail: () => Taro.showToast({ title: '打开失败，请稍后重试', icon: 'none' }),
    })
  }

  function handleSkip() {
    Taro.switchTab({ url: '/pages/practice/index' })
  }

  return (
    <View className={styles.page}>
      <View className={styles.hero}>
        <View className={styles.brandBadge}>
          <Text className={styles.brandText}>医护自学辅助</Text>
        </View>
        <Text className={styles.title}>完善学员信息</Text>
        <Text className={styles.desc}>填写后老师可在后台按姓名、班级查到你的刷题记录和模考成绩。</Text>
      </View>

      <View className={styles.formCard}>
        <View className={styles.field}>
          <Text className={styles.label}>姓名 <Text className={styles.required}>*</Text></Text>
          <View className={styles.inputWrap}>
            <Input
              className={styles.input}
              placeholder='请输入真实姓名'
              placeholderClass={styles.placeholder}
              value={realName}
              onInput={(e) => setRealName(e.detail.value)}
            />
          </View>
        </View>

        <View className={styles.field}>
          <Text className={styles.label}>班级 / 校区</Text>
          <View className={styles.inputWrap}>
            <Input
              className={styles.input}
              placeholder='如：护理2班、北京校区'
              placeholderClass={styles.placeholder}
              value={className}
              onInput={(e) => setClassName(e.detail.value)}
            />
          </View>
        </View>

        <View className={styles.field}>
          <Text className={styles.label}>微信备注名</Text>
          <View className={styles.inputWrap}>
            <Input
              className={styles.input}
              placeholder='选填，方便老师核对'
              placeholderClass={styles.placeholder}
              value={wechatId}
              onInput={(e) => setWechatId(e.detail.value)}
            />
          </View>
        </View>

        <View
          className={cx(styles.button, submitting && styles.buttonDisabled)}
          onTap={!submitting ? handleSubmit : undefined}
        >
          {submitting ? '保存中...' : '保存信息'}
        </View>
        <View className={styles.skip} onTap={handleSkip}><Text>暂时跳过</Text></View>
      </View>

      {privacyVisible && (
        <View className={styles.privacyMask}>
          <View className={styles.privacyDialog}>
            <Text className={styles.privacyTitle}>需要你的同意</Text>
            <Text className={styles.privacyDesc}>
              保存学员信息前，请先阅读并同意《{privacyContractName}》。
            </Text>
            <View className={styles.privacyLink} onTap={handleOpenPrivacyContract}>
              <Text>查看{privacyContractName}</Text>
            </View>
            <View className={styles.privacyActions}>
              <View className={styles.privacyCancel} onTap={() => setPrivacyVisible(false)}>
                <Text>暂不同意</Text>
              </View>
              <Button
                className={styles.privacyAgreeButton}
                openType={'agreePrivacyAuthorization' as any}
                onAgreePrivacyAuthorization={handlePrivacyAgree}
              >
                同意并保存
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
