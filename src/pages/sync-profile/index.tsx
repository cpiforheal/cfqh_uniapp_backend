import { Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { getProfileOverview, syncProfile } from '@/services/nursing'
import { cx } from '@/utils/classNames'
import styles from './index.module.scss'

export default function SyncProfilePage() {
  const [realName, setRealName] = useState('')
  const [className, setClassName] = useState('')
  const [phoneTail, setPhoneTail] = useState('')
  const [wechatId, setWechatId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true
    getProfileOverview()
      .then((profile) => {
        if (!mounted) return
        setRealName(profile.realName || '')
        setClassName(profile.className || '')
        setPhoneTail(profile.phoneTail || '')
        setWechatId(profile.wechatId || '')
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  async function handleSubmit() {
    if (!realName.trim()) {
      Taro.showToast({ title: '请填写姓名', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await syncProfile({ realName: realName.trim(), className: className.trim(), phoneTail: phoneTail.trim(), wechatId: wechatId.trim() })
      Taro.showToast({ title: '信息已保存', icon: 'success' })
      setTimeout(() => Taro.switchTab({ url: '/pages/practice/index' }), 600)
    } catch {
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
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
          <Text className={styles.label}>手机号后四位</Text>
          <View className={styles.inputWrap}>
            <Input
              className={styles.input}
              placeholder='用于核对身份'
              placeholderClass={styles.placeholder}
              type='number'
              maxlength={4}
              value={phoneTail}
              onInput={(e) => setPhoneTail(e.detail.value)}
            />
          </View>
        </View>

        <View className={styles.field}>
          <Text className={styles.label}>微信号 / 微信备注名</Text>
          <View className={styles.inputWrap}>
            <Input
              className={styles.input}
              placeholder='方便老师添加好友'
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
    </View>
  )
}
