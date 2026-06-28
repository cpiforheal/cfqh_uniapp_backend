import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getStudyCardModules } from '@/services/studyCards'
import type { StudyCardHomeData, StudyCardModule } from '@/types/studyCard'
import { cx } from '@/utils/classNames'
import anatomySvg from '@/assets/study-cards/anatomy.svg'
import physiologySvg from '@/assets/study-cards/physiology.svg'
import clinicalSvg from '@/assets/study-cards/clinical.svg'
import skillsSvg from '@/assets/study-cards/skills.svg'
import styles from './index.module.scss'

const MODULE_CONFIG: Record<string, { icon: string; route: string; tone: string }> = {
  intro: { icon: anatomySvg, route: '基础启程', tone: 'green' },
  locomotor: { icon: physiologySvg, route: '高频突破', tone: 'orange' },
  physiology: { icon: clinicalSvg, route: '理解巩固', tone: 'blue' },
  clinical: { icon: skillsSvg, route: '应用提升', tone: 'purple' },
  skills: { icon: skillsSvg, route: '技能演练', tone: 'purple' },
}

function getModuleTitle(name: string) {
  return name.endsWith('带背') ? name : `${name}带背`
}

function getPercent(mod: StudyCardModule) {
  if (mod.questionCount <= 0) return 0
  return Math.min(100, Math.round((mod.masteredCount / mod.questionCount) * 100))
}

export default function StudyCardsPage() {
  const [data, setData] = useState<StudyCardHomeData>({ modules: [], streak: 0, totalMastered: 0 })

  useDidShow(() => {
    getStudyCardModules().then(setData)
  })

  const { modules, streak } = data
  const availableModules = modules.filter((mod) => mod.questionCount > 0)
  const recommended = availableModules.find((mod) => mod.masteredCount < mod.questionCount) || availableModules[0] || null
  const remainingCount = modules.reduce((sum, mod) => sum + Math.max(mod.questionCount - mod.masteredCount, 0), 0)
  const suggestedCount = recommended ? Math.min(recommended.questionCount - recommended.masteredCount, 10) : 0
  const estimatedMinutes = Math.max(1, Math.ceil(suggestedCount * 1.5))

  function goList(mod: StudyCardModule) {
    if (mod.questionCount === 0) return
    Taro.navigateTo({
      url: `/pages/study-card-list/index?moduleCode=${mod.moduleCode}&moduleName=${encodeURIComponent(mod.moduleName)}`,
    })
  }

  return (
    <View className={styles.page}>
      <View className={styles.hero}>
        <View className={styles.heroTop}>
          <View className={styles.heroTitleBlock}>
            <Text className={styles.heroEyebrow}>带背</Text>
            <Text className={styles.heroTitle}>今日重点</Text>
          </View>
          <Text className={styles.heroStreak}>连续 {streak}</Text>
        </View>

        {recommended && (
          <View className={styles.recommendCard} onTap={() => goList(recommended)}>
            <View className={styles.recommendMain}>
              <Text className={styles.recommendLabel}>先背</Text>
              <Text className={styles.recommendTitle}>{getModuleTitle(recommended.moduleName)}</Text>
              <View className={styles.recommendMeta}>
                <Text>剩 {Math.max(recommended.questionCount - recommended.masteredCount, 0)} 题</Text>
                <Text>约 {estimatedMinutes} 分钟</Text>
                <Text>{recommended.knowledgeCardCount} 卡</Text>
              </View>
            </View>
            <View className={styles.recommendAction}>
              <Text className={styles.recommendActionText}>去背</Text>
            </View>
          </View>
        )}

      </View>

      <View className={styles.summaryStrip}>
        <View className={styles.summaryItem}>
          <Text className={styles.summaryValue}>{availableModules.length}</Text>
          <Text className={styles.summaryLabel}>可学章节</Text>
        </View>
        <View className={styles.summaryDivider} />
        <View className={styles.summaryItem}>
          <Text className={styles.summaryValue}>{remainingCount}</Text>
          <Text className={styles.summaryLabel}>待背</Text>
        </View>
        <View className={styles.summaryDivider} />
        <View className={styles.summaryItem}>
          <Text className={styles.summaryValue}>{modules.reduce((sum, mod) => sum + mod.knowledgeCardCount, 0)}</Text>
          <Text className={styles.summaryLabel}>卡片</Text>
        </View>
      </View>

      <View className={styles.sectionHead}>
        <Text className={styles.sectionTitle}>章节</Text>
        <Text className={styles.sectionHint}>进度</Text>
      </View>

      <View className={styles.moduleList}>
        {modules.map((mod) => {
          const config = MODULE_CONFIG[mod.moduleCode] || MODULE_CONFIG.intro
          const percent = getPercent(mod)
          const completed = mod.questionCount > 0 && mod.masteredCount >= mod.questionCount
          const unavailable = mod.questionCount === 0
          return (
            <View
              key={mod.moduleCode}
              className={cx(styles.taskCard, completed && styles.taskCardDone, unavailable && styles.taskCardMuted)}
              onTap={() => goList(mod)}
            >
              <View className={styles.routeColumn}>
                <View className={cx(styles.routeDot, styles[`tone_${config.tone}`])} />
                <View className={styles.routeLine} />
              </View>
              <View className={styles.taskBody}>
                <View className={styles.taskTop}>
                  <View className={styles.taskTitleWrap}>
                    <Text className={styles.taskMeta}>{config.route}</Text>
                    <Text className={styles.taskTitle}>{getModuleTitle(mod.moduleName)}</Text>
                  </View>
                  <Image className={styles.taskIcon} src={config.icon} mode="aspectFit" />
                </View>
                <View className={styles.taskFacts}>
                  <Text className={styles.factStrong}>{unavailable ? '整理中' : `${mod.questionCount} 题`}</Text>
                  <Text className={styles.factText}>{unavailable ? '未开放' : `${mod.knowledgeCardCount} 卡`}</Text>
                  {!unavailable && <Text className={styles.factGreen}>已掌握 {mod.masteredCount}</Text>}
                </View>
                {!unavailable && (
                  <View className={styles.progressRow}>
                    <View className={styles.progressTrack}>
                      <View className={styles.progressFill} style={{ width: `${percent}%` }} />
                    </View>
                    <Text className={styles.progressText}>{percent}%</Text>
                  </View>
                )}
              </View>
              {!unavailable && (
                <View className={cx(styles.taskButton, completed && styles.taskButtonDone)}>
                  <Text>{completed ? '复盘' : '继续'}</Text>
                </View>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}
