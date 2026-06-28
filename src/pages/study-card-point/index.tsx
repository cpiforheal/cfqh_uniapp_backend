import { ScrollView, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { getNextQuestionId, getStudyCardDetail } from '@/services/studyCards'
import type { RichTextSegment, StudyCardDetail } from '@/types/studyCard'
import styles from './index.module.scss'

function getSegmentStyle(seg: RichTextSegment) {
  if (!seg.color && !seg.bold) return undefined
  return {
    ...(seg.color ? { color: seg.color, fontWeight: '600' as const } : {}),
    ...(seg.bold ? { fontWeight: 'bold' as const } : {}),
  }
}

function splitIntoParagraphs(body: RichTextSegment[]): RichTextSegment[][] {
  const paragraphs: RichTextSegment[][] = []
  let current: RichTextSegment[] = []
  for (const seg of body) {
    if (seg.text === '\n' && !seg.color) {
      if (current.length > 0) {
        paragraphs.push(current)
        current = []
      }
    } else {
      current.push(seg)
    }
  }
  if (current.length > 0) paragraphs.push(current)
  return paragraphs
}

export default function StudyCardPointPage() {
  const router = useRouter()
  const id = router.params.id || ''
  const moduleCode = router.params.moduleCode || ''

  const [detail, setDetail] = useState<StudyCardDetail | null>(null)
  const [current, setCurrent] = useState(0)
  const [nextId, setNextId] = useState<string | null>(null)

  useEffect(() => {
    getStudyCardDetail(id).then(setDetail)
    if (moduleCode) {
      getNextQuestionId(moduleCode, id).then(setNextId)
    }
  }, [id, moduleCode])

  if (!detail) {
    return <View className={styles.page}><Text className={styles.loadingText}>加载中...</Text></View>
  }

  const cards = detail.knowledgeCards
  const total = cards.length

  return (
    <View className={styles.page}>
      <View className={styles.topBar}>
        <View className={styles.sourceInfo}>
          <Text className={styles.sourceLabel}>知识卡</Text>
          <Text className={styles.sourceTitle}>{detail.moduleName} · 第 {detail.seq} 题</Text>
        </View>
        <View className={styles.pageIndicator}>
          <Text className={styles.pageIndicatorCurrent}>{total > 0 ? current + 1 : 0}</Text>
          <Text className={styles.pageIndicatorTotal}>/{total}</Text>
        </View>
      </View>

      {total > 0 && (
        <View className={styles.dotRow}>
          {cards.map((_, idx) => (
            <View key={idx} className={idx === current ? styles.dotActive : styles.dot} />
          ))}
        </View>
      )}

      <View className={styles.swiperWrap}>
        {total === 0 ? (
          <View className={styles.emptyCard}>
            <Text className={styles.emptyTitle}>暂无知识卡</Text>
            <Text className={styles.emptyText}>先回到题目</Text>
          </View>
        ) : (
          <Swiper
            className={styles.swiper}
            current={current}
            onChange={(e) => setCurrent(e.detail.current)}
            duration={300}
          >
          {cards.map((card, idx) => {
            const paragraphs = splitIntoParagraphs(card.body)
            const topPara = paragraphs[0] || []
            const bottomParas = paragraphs.slice(1)
            return (
              <SwiperItem key={idx} className={styles.swiperItem}>
                <ScrollView scrollY className={styles.cardScroll}>
                  <View className={styles.paperCard}>
                    <View className={styles.paperTop}>
                      <View className={styles.cardNumber}>
                        <Text>{idx + 1}</Text>
                      </View>
                      <View className={styles.cardTitleBlock}>
                        <Text className={styles.cardKicker}>重点卡片</Text>
                        <Text className={styles.cardTitle}>{card.title}</Text>
                      </View>
                    </View>

                    <View className={styles.highlightBlock}>
                      <View className={styles.highlightBar} />
                      <View className={styles.highlightText}>
                        {topPara.map((seg: RichTextSegment, i: number) => (
                          <Text key={i} style={getSegmentStyle(seg)}>
                            {seg.text}
                          </Text>
                        ))}
                      </View>
                    </View>

                    {bottomParas.length > 0 && (
                      <View className={styles.detailBlock}>
                        <Text className={styles.detailTitle}>说明</Text>
                        {bottomParas.map((para, pIdx) => (
                          <View key={pIdx} className={styles.detailPara}>
                            <Text className={styles.paraIndex}>{pIdx + 1}</Text>
                            <View className={styles.paraText}>
                              {para.map((seg: RichTextSegment, i: number) => (
                                <Text key={i} style={getSegmentStyle(seg)}>
                                  {seg.text}
                                </Text>
                              ))}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </ScrollView>
              </SwiperItem>
            )
          })}
          </Swiper>
        )}
      </View>

      <View className={styles.bottomBar}>
        <View className={styles.btnBack} onTap={() => Taro.navigateBack()}>
          <Text>回到题目</Text>
        </View>
        {nextId && (
          <View
            className={styles.btnNext}
            onTap={() => Taro.redirectTo({ url: `/pages/study-card-detail/index?id=${nextId}&moduleCode=${moduleCode}` })}
          >
            <Text>下一题</Text>
          </View>
        )}
      </View>
    </View>
  )
}
