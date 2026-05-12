import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { getLicenseStatus, getVideoLessons } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
import type { VideoLessonSummary } from '@/types/study'
import styles from './index.module.scss'

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoLessonSummary[]>([])
  const [authorized, setServerAuthorized] = useState(false)
  const [checkingAuthorization, setCheckingAuthorization] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const setAuthorized = useAuthStore((state) => state.setAuthorized)

  const loadVideos = useCallback(async () => {
    setCheckingAuthorization(true)
    setIsLoading(true)
    setLoadError(false)
    try {
      const status = await getLicenseStatus()
      setServerAuthorized(Boolean(status.authorized))
      setCheckingAuthorization(false)
      if (!status.authorized) {
        setVideos([])
        return
      }
      const tokenCode = status.authorization?.licenseToken?.code
      if (tokenCode) setAuthorized(tokenCode, status.authorization?.expiresAt)
      const list = await getVideoLessons()
      setVideos(list)
    } catch {
      setLoadError(true)
      setVideos([])
      setCheckingAuthorization(false)
    } finally {
      setIsLoading(false)
    }
  }, [setAuthorized])

  useDidShow(() => {
    loadVideos()
  })

  usePullDownRefresh(async () => {
    await loadVideos()
    Taro.stopPullDownRefresh()
  })

  useEffect(() => {
    if (!isLoading) Taro.stopPullDownRefresh()
  }, [isLoading])

  function goPlayer(id: string) {
    Taro.navigateTo({ url: `/pages/video-player/index?id=${id}` })
  }

  function goActivate() {
    Taro.navigateTo({ url: '/pages/activate/index' })
  }

  return (
    <View className={styles.page}>
      <View className={styles.decoBlob1} />
      <View className={styles.decoBlob2} />
      <Text className={styles.pageTitle}>公开讲解</Text>

      {checkingAuthorization ? (
        <View className={styles.statusCard}>
          <Text className={styles.statusTitle}>正在确认授权</Text>
          <Text className={styles.statusDesc}>请稍候...</Text>
        </View>
      ) : !authorized ? (
        <View className={styles.lockCard}>
          <Text className={styles.lockTitle}>视频已锁定</Text>
          <Text className={styles.lockDesc}>输入学习通行码后，可按模块查看对应讲解视频。</Text>
          <View className={styles.lockButton} onTap={goActivate}>
            <Text className={styles.lockButtonText}>去激活</Text>
          </View>
        </View>
      ) : isLoading && videos.length === 0 ? (
        <View className={styles.emptyCard}>
          <Text className={styles.emptyText}>正在加载...</Text>
        </View>
      ) : loadError ? (
        <View className={styles.emptyCard}>
          <Text className={styles.emptyText}>加载失败，请下拉重试</Text>
        </View>
      ) : videos.length === 0 ? (
        <View className={styles.emptyCard}>
          <Text className={styles.emptyText}>暂无已发布视频</Text>
        </View>
      ) : (
        <View className={styles.videoGrid}>
          {videos.map((video) => (
            <View className={styles.videoCard} key={video.id} onTap={() => goPlayer(video.id)}>
              <View className={styles.videoCover}>
                {video.coverUrl
                  ? <Image src={video.coverUrl} mode="aspectFill" className={styles.videoCoverImage} />
                  : <Text className={styles.videoCoverText}>讲解</Text>}
                <View className={styles.videoDuration}>
                  <Text className={styles.videoDurationText}>{video.duration}min</Text>
                </View>
              </View>
              <View className={styles.videoInfo}>
                <Text className={styles.videoTitle}>{video.title}</Text>
                <Text className={styles.videoMeta}>{video.moduleName || '医护模块'} · {video.chapter || '章节'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
