import { Picker, Switch, Text, View } from '@tarojs/components'
import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settings'
import styles from './index.module.scss'

const DAILY_GOALS = [10, 20, 30, 50]
const TIMER_OPTIONS = [60, 90, 120]
const DIFFICULTY_OPTIONS = [
  { value: 'auto', label: '自动匹配' },
  { value: 'basic', label: '基础' },
  { value: 'medium', label: '中等' },
  { value: 'advanced', label: '较难' },
]
const REVIEW_FREQUENCY_OPTIONS = [
  { value: 'daily', label: '每天复刷' },
  { value: 'alternate', label: '隔天复刷' },
  { value: 'exam', label: '考前强化' },
]

export default function SettingsPage() {
  const { settings, update, hydrate } = useSettingsStore()

  useEffect(() => { hydrate() }, [hydrate])

  return (
    <View className={styles.page}>
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>考试与目标</Text>
        <View className={styles.item}>
          <Text className={styles.itemLabel}>每日目标</Text>
          <Picker
            mode="selector"
            range={DAILY_GOALS.map((g) => `${g} 题`)}
            value={DAILY_GOALS.indexOf(settings.dailyGoal)}
            onChange={(e) => update({ dailyGoal: DAILY_GOALS[Number(e.detail.value)] })}
          >
            <Text className={styles.itemValue}>{settings.dailyGoal} 题 ▸</Text>
          </Picker>
        </View>
        <View className={styles.item}>
          <Text className={styles.itemLabel}>考试日期</Text>
          <Picker
            mode="date"
            value={settings.examDate || new Date().toISOString().slice(0, 10)}
            onChange={(e) => update({ examDate: e.detail.value })}
          >
            <Text className={styles.itemValue}>{settings.examDate || '未设置'} ▸</Text>
          </Picker>
        </View>
        <View className={styles.item}>
          <Text className={styles.itemLabel}>难度偏好</Text>
          <Picker
            mode="selector"
            range={DIFFICULTY_OPTIONS.map((d) => d.label)}
            value={DIFFICULTY_OPTIONS.findIndex((d) => d.value === settings.difficultyPreference)}
            onChange={(e) => update({ difficultyPreference: DIFFICULTY_OPTIONS[Number(e.detail.value)].value as any })}
          >
            <Text className={styles.itemValue}>{DIFFICULTY_OPTIONS.find((d) => d.value === settings.difficultyPreference)?.label} ▸</Text>
          </Picker>
        </View>
        <View className={styles.item}>
          <Text className={styles.itemLabel}>错题复刷频率</Text>
          <Picker
            mode="selector"
            range={REVIEW_FREQUENCY_OPTIONS.map((r) => r.label)}
            value={REVIEW_FREQUENCY_OPTIONS.findIndex((r) => r.value === settings.reviewFrequency)}
            onChange={(e) => update({ reviewFrequency: REVIEW_FREQUENCY_OPTIONS[Number(e.detail.value)].value as any })}
          >
            <Text className={styles.itemValue}>{REVIEW_FREQUENCY_OPTIONS.find((r) => r.value === settings.reviewFrequency)?.label} ▸</Text>
          </Picker>
        </View>
      </View>

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>答题体验</Text>
        <View className={styles.item}>
          <Text className={styles.itemLabel}>选项乱序</Text>
          <Switch checked={settings.shuffleOptions} onChange={(e) => update({ shuffleOptions: e.detail.value })} color="#5cd6b4" />
        </View>
        <View className={styles.item}>
          <Text className={styles.itemLabel}>答题计时</Text>
          <Switch checked={settings.timerEnabled} onChange={(e) => update({ timerEnabled: e.detail.value })} color="#5cd6b4" />
        </View>
        {settings.timerEnabled && (
          <View className={styles.item}>
            <Text className={styles.itemLabel}>每题限时</Text>
            <Picker
              mode="selector"
              range={TIMER_OPTIONS.map((t) => `${t} 秒`)}
              value={TIMER_OPTIONS.indexOf(settings.timerSeconds)}
              onChange={(e) => update({ timerSeconds: TIMER_OPTIONS[Number(e.detail.value)] })}
            >
              <Text className={styles.itemValue}>{settings.timerSeconds} 秒 ▸</Text>
            </Picker>
          </View>
        )}
        <View className={styles.item}>
          <Text className={styles.itemLabel}>答对自动翻页</Text>
          <Switch checked={settings.autoNext} onChange={(e) => update({ autoNext: e.detail.value })} color="#5cd6b4" />
        </View>
      </View>

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>学习习惯</Text>
        <View className={styles.item}>
          <Text className={styles.itemLabel}>休息提醒</Text>
          <Switch checked={settings.restReminder} onChange={(e) => update({ restReminder: e.detail.value })} color="#5cd6b4" />
        </View>
        {settings.restReminder && (
          <View className={styles.item}>
            <Text className={styles.itemLabel}>连续做题提醒</Text>
            <Text className={styles.itemValue}>{settings.restMinutes} 分钟后</Text>
          </View>
        )}
        <View className={styles.item}>
          <Text className={styles.itemLabel}>排行榜匿名</Text>
          <Switch checked={settings.rankAnonymous} onChange={(e) => update({ rankAnonymous: e.detail.value })} color="#5cd6b4" />
        </View>
      </View>

      <View className={styles.footer}>
        <Text className={styles.footerText}>设置自动保存，仅存储在本机</Text>
      </View>
    </View>
  )
}
