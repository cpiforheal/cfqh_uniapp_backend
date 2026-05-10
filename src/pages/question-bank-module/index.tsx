import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { getLicenseStatus, getModuleQuestions } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
import type { ChapterQuestionGroup } from '@/types/study'
import styles from './index.module.scss'

const moduleChapterPresets: Record<string, Array<{ title: string; preview: string }>> = {
  anatomy: [
    { title: '绪论', preview: '基础概念入口' },
    { title: '运动系统', preview: '骨学、关节学、肌学' },
    { title: '消化系统', preview: '内脏学总论、消化道、消化腺' },
    { title: '呼吸系统', preview: '呼吸道、肺、胸膜及纵隔' },
    { title: '泌尿系统', preview: '肾、输尿管、膀胱' },
    { title: '男性生殖系统', preview: '男性生殖器、男性尿道' },
    { title: '女性生殖系统', preview: '女性生殖器' },
    { title: '腹膜', preview: '概述、与脏器关系、形成结构' },
    { title: '脉管系统', preview: '心血管系统总论、心、动脉静脉淋巴' },
    { title: '感觉器', preview: '视器、前庭蜗器' },
    { title: '神经系统', preview: '总论、脑与脊髓、中枢神经、脑循环' },
    { title: '内分泌系统', preview: '内分泌腺' },
  ],
  physiology: [
    { title: '细胞生理', preview: '细胞功能与信号传导' },
    { title: '血液', preview: '血液组成、凝血、免疫' },
    { title: '循环系统', preview: '心功能与血流调节' },
    { title: '呼吸系统', preview: '通气与换气' },
    { title: '消化与吸收', preview: '消化液与吸收机制' },
    { title: '泌尿系统', preview: '肾小球滤过与尿液生成' },
    { title: '感觉器官', preview: '视觉听觉与感受器' },
    { title: '神经系统', preview: '神经活动与反射调控' },
    { title: '内分泌', preview: '激素作用与调节' },
    { title: '生殖', preview: '生殖生理与调节' },
  ],
  clinical_medicine: [
    { title: '症状学', preview: '常见症状与问诊思路' },
    { title: '实验室与辅助检查', preview: '检验结果判读基础' },
    { title: '呼吸系统疾病', preview: '常见病分类与特点' },
    { title: '循环系统疾病', preview: '心血管常见病复习' },
    { title: '消化系统疾病', preview: '消化系统高频考点' },
    { title: '泌尿系统疾病', preview: '泌尿系统常见疾病' },
    { title: '血液系统疾病', preview: '贫血及血液病基础' },
    { title: '内分泌和代谢', preview: '糖代谢与内分泌疾病' },
    { title: '风湿免疫', preview: '免疫相关疾病复习' },
    { title: '脑血管疾病', preview: '神经系统常见病' },
    { title: '传染病', preview: '感染性疾病基础' },
  ],
  clinical_skills: [
    { title: '技能一', preview: '基础操作与评估' },
    { title: '技能二', preview: '无菌与护理操作' },
    { title: '技能三', preview: '临床沟通与记录' },
    { title: '技能四', preview: '急救与应急处理' },
    { title: '技能五', preview: '综合评估与协作' },
    { title: '技能六', preview: '全流程演练' },
  ],
}

function isChapterMatched(chapter: string, presetTitle: string) {
  return chapter.includes(presetTitle) || presetTitle.includes(chapter)
}

export default function QuestionBankModulePage() {
  const router = Taro.useRouter()
  const moduleCode = String(router.params.moduleCode || 'anatomy')
  const moduleName = decodeURIComponent(String(router.params.moduleName || '医护模块'))
  const setAuthorized = useAuthStore((state) => state.setAuthorized)
  const { data: licenseStatus, isLoading: isLicenseLoading } = useQuery({
    queryKey: ['licenseStatus'],
    queryFn: getLicenseStatus,
  })
  const authorized = Boolean(licenseStatus?.authorized)
  const checkingAuthorization = !authorized && isLicenseLoading

  const { data = [], refetch, isRefetching } = useQuery({
    queryKey: ['moduleQuestions', moduleCode],
    queryFn: () => getModuleQuestions(moduleCode),
    enabled: authorized,
  })

  const chapterGroups = useMemo<ChapterQuestionGroup[]>(() => {
    const map = new Map<string, ChapterQuestionGroup>()
    data.forEach((question) => {
      const chapter = (question.chapter || '未归类章节').trim() || '未归类章节'
      const existing = map.get(chapter)
      if (existing) {
        existing.questions.push(question)
      } else {
        map.set(chapter, { chapter, questions: [question] })
      }
    })
    return Array.from(map.values())
  }, [data])

  const chapterPresets = useMemo(() => moduleChapterPresets[moduleCode] || [], [moduleCode])

  const mergedChapters = useMemo(() => {
    const realChapters = chapterGroups.map((group) => {
      const matchedPreset = chapterPresets.find((preset) => isChapterMatched(group.chapter, preset.title))
      return {
        chapter: group.chapter,
        preview: matchedPreset?.preview || '已同步题库章节',
        questionCount: group.questions.length,
      }
    })

    const lockedOutline = chapterPresets
      .filter((preset) => !chapterGroups.find((group) => isChapterMatched(group.chapter, preset.title)))
      .map((preset) => ({
        chapter: preset.title,
        preview: preset.preview,
        questionCount: 0,
      }))

    return [...realChapters, ...lockedOutline]
  }, [chapterPresets, chapterGroups])

  const [activeChapter, setActiveChapter] = useState<string>('')

  useEffect(() => {
    const preferredChapter = mergedChapters.find((item) => item.questionCount > 0)?.chapter || mergedChapters[0]?.chapter || ''
    if (!preferredChapter) return

    const active = mergedChapters.find((item) => item.chapter === activeChapter)
    if (!activeChapter || !active || (chapterGroups.length > 0 && active.questionCount === 0)) {
      setActiveChapter(preferredChapter)
    }
  }, [mergedChapters, activeChapter])

  const currentGroup = chapterGroups.find((item) => item.chapter === activeChapter)

  useEffect(() => {
    if (!licenseStatus?.authorized) return
    const tokenCode = licenseStatus.authorization?.licenseToken?.code
    if (tokenCode) setAuthorized(tokenCode, licenseStatus.authorization?.expiresAt)
    refetch()
  }, [licenseStatus, refetch, setAuthorized])

  useDidShow(() => {
    if (authorized) refetch()
  })

  usePullDownRefresh(async () => {
    if (authorized) await refetch()
    Taro.stopPullDownRefresh()
  })

  useEffect(() => {
    if (!isRefetching) Taro.stopPullDownRefresh()
  }, [isRefetching])

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.title}>{moduleName}</Text>
        <Text className={styles.subtitle}>{authorized ? '左侧子章节带预览，点击后右侧展示对应题目' : '当前仅展示课程章节框架，激活后查看题目和解析'}</Text>
      </View>

      {!authorized && (
        <View className={styles.lockPanel}>
          <Text className={styles.lockTitle}>{checkingAuthorization ? '正在确认授权' : '题目内容已锁定'}</Text>
          <Text className={styles.lockText}>{checkingAuthorization ? '正在读取本机缓存和后端授权状态，请稍候。' : '输入学习通行码后，系统会展示本模块下的题目、答案解析、练习进度和错题记录。'}</Text>
          {!checkingAuthorization && (
            <View className={styles.lockButton} onTap={() => Taro.navigateTo({ url: '/pages/activate/index' })}>
              <Text className={styles.lockButtonText}>去激活</Text>
            </View>
          )}
        </View>
      )}

      <View className={styles.layout}>
        <View className={styles.sidebar}>
          {mergedChapters.map((group) => (
            <View
              key={group.chapter}
              className={`${styles.chapterItem} ${activeChapter === group.chapter ? styles.chapterItemActive : ''}`}
              onTap={() => setActiveChapter(group.chapter)}
            >
              <Text className={styles.chapterName}>{group.chapter}</Text>
              <Text className={styles.chapterPreview}>{group.preview}</Text>
              <Text className={styles.chapterCount}>{authorized ? `${group.questionCount} 题` : '待解锁'}</Text>
            </View>
          ))}
        </View>

        <View className={styles.content}>
          {!authorized ? (
            <View className={styles.empty}><Text>{checkingAuthorization ? '正在确认授权状态' : '激活后查看本章节题目列表'}</Text></View>
          ) : !currentGroup ? (
            <View className={styles.empty}><Text>当前子章节暂无题目，稍后可在后台补充后自动同步</Text></View>
          ) : (
            <View className={styles.chapterCard}>
              <Text className={styles.chapterTitle}>{currentGroup.chapter}</Text>
              <Text className={styles.chapterMeta}>共 {currentGroup.questions.length} 题</Text>
              <View className={styles.questionList}>
                {currentGroup.questions.map((question, index) => (
                  <View
                    key={question.id}
                    className={styles.questionItem}
                    onTap={() => Taro.navigateTo({ url: `/pages/question-detail/index?id=${question.id}` })}
                  >
                    <Text className={styles.questionTitle}>{index + 1}. {question.title}</Text>
                    <Text className={styles.questionMeta}>难度 {question.difficultyText} · {question.knowledgePoints.map((item) => item.name).join('、') || '未标注知识点'}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
