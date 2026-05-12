import { Text, Video, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { getLicenseStatus, getVideoLessons, reportVideoPlay } from '@/services/nursing'
import type { VideoLessonSummary } from '@/types/study'
import styles from './index.module.scss'

export default function VideoPlayerPage() {
  const router = Taro.useRouter()
  const videoId = router.params.id || ''
  const [video, setVideo] = useState<VideoLessonSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const reportedRef = useRef(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const status = await getLicenseStatus()
      if (!status?.authorized) {
        Taro.showToast({ title: '请先激活通行码', icon: 'none' })
        Taro.navigateBack()
        return
      }
      const videos = await getVideoLessons()
      const found = videos.find((v) => v.id === videoId)
      setVideo(found || null)
      setLoading(false)
    }
    load()
  }, [videoId])

  function handlePlay() {
    if (reportedRef.current || !video) return
    reportedRef.current = true
    reportVideoPlay(video.id)
  }

  function handleError() {
    Taro.showToast({ title: '视频暂不可播放', icon: 'none' })
  }

  if (loading) {
    return (
      <View className={styles.page}>
        <Text className={styles.loadingText}>加载中...</Text>
      </View>
    )
  }

  if (!video) {
    return (
      <View className={styles.page}>
        <Text className={styles.loadingText}>未找到该视频</Text>
      </View>
    )
  }

  return (
    <View className={styles.page}>
      {video.videoUrl ? (
        <Video
          id={`player-${video.id}`}
          src={video.videoUrl}
          poster={video.coverUrl || ''}
          controls
          autoplay
          showFullscreenBtn
          showPlayBtn
          objectFit="contain"
          onPlay={handlePlay}
          onError={handleError}
          className={styles.player}
        />
      ) : (
        <View className={styles.noVideo}>
          <Text className={styles.noVideoText}>该视频暂无播放地址</Text>
        </View>
      )}
      <View className={styles.info}>
        <Text className={styles.title}>{video.title}</Text>
        <Text className={styles.meta}>{video.moduleName || '医护模块'} · {video.chapter || '章节'} · {video.duration} 分钟</Text>
        <View className={styles.tags}>
          {video.knowledgePoints.map((p) => (
            <Text key={p.id} className={styles.tag}>{p.name}</Text>
          ))}
        </View>
      </View>
    </View>
  )
}
