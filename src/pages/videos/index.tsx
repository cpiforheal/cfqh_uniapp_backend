import { Image, Text, Video, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getVideoLessons } from '@/services/nursing'
import { isAuthorized } from '@/services/nursing'
import { useAuthStore } from '@/stores/auth'
import type { VideoLessonSummary } from '@/types/study'

function VideoItem({ video, active, onPlay }: { video: VideoLessonSummary; active: boolean; onPlay: () => void }) {
  const canPlay = Boolean(video.videoUrl)

  function handleError() {
    Taro.showToast({ title: '视频暂不可播放，请检查 COS 链接', icon: 'none' })
  }

  return (
    <View style={{ marginTop: '20px', padding: '22px', borderRadius: '20px', background: '#fff', boxShadow: '0 10px 24px rgba(24,67,76,0.05)' }}>
      {active && canPlay ? (
        <Video
          id={`video-${video.id}`}
          src={video.videoUrl || ''}
          poster={video.coverUrl || ''}
          controls
          autoplay
          showFullscreenBtn
          showPlayBtn
          objectFit="contain"
          onError={handleError}
          style={{ width: '100%', height: '380px', borderRadius: '16px', overflow: 'hidden', background: '#101820' }}
        />
      ) : (
        <View onTap={onPlay} style={{ height: '220px', borderRadius: '16px', overflow: 'hidden', background: '#e9f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {video.coverUrl ? <Image src={video.coverUrl} mode="aspectFill" style={{ width: '100%', height: '220px' }} /> : <Text style={{ color: '#138b8f', fontSize: '28px', fontWeight: 700 }}>公开讲解</Text>}
        </View>
      )}
      <View style={{ marginTop: '18px' }}>
        <Text style={{ display: 'block', color: '#17364c', fontSize: '30px', fontWeight: '700', lineHeight: 1.45 }}>{video.title}</Text>
        <Text style={{ display: 'block', marginTop: '8px', color: '#627577', fontSize: '24px' }}>{video.moduleName || '医护模块'} · {video.chapter || '小章节预留'} · {video.duration} 分钟</Text>
        <View style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '14px' }}>
          {video.knowledgePoints.map((point) => <Text key={point.id} style={{ padding: '6px 12px', borderRadius: '999px', background: '#eef8f8', color: '#138b8f', fontSize: '22px' }}>{point.name}</Text>)}
          <Text style={{ padding: '6px 12px', borderRadius: '999px', background: canPlay ? '#eef8f0' : '#f6f6f6', color: canPlay ? '#2f8f52' : '#8a989a', fontSize: '22px' }}>{canPlay ? 'COS 链接可播放' : '暂无播放地址'}</Text>
        </View>
        <View onTap={canPlay ? onPlay : undefined} style={{ marginTop: '18px', height: '56px', borderRadius: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: canPlay ? '#138b8f' : '#d8e3e4' }}>
          <Text style={{ color: '#fff', fontSize: '26px', fontWeight: '700' }}>{active && canPlay ? '正在播放' : canPlay ? '播放视频' : '待补充 COS 链接'}</Text>
        </View>
      </View>
    </View>
  )
}

export default function VideosPage() {
  const [activeVideoId, setActiveVideoId] = useState<string>()
  const authStatus = useAuthStore((state) => state.status)
  const authorized = isAuthorized(authStatus)
  const { data = [], refetch, isRefetching } = useQuery({
    queryKey: ['videoLessons'],
    queryFn: () => getVideoLessons(),
    enabled: authorized,
  })

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
    <View style={{ minHeight: '100vh', padding: '32px 24px 72px', background: '#f7fbfb', boxSizing: 'border-box' }}>
      <Text style={{ display: 'block', color: '#17364c', fontSize: '38px', fontWeight: '800' }}>公开讲解</Text>
      <Text style={{ display: 'block', marginTop: '12px', color: '#627577', fontSize: '25px', lineHeight: 1.6 }}>{authorized ? '后台发布后，这里直接播放 COS 自定义域名视频链接。' : '当前仅展示公开讲解资源入口，激活后可查看已发布视频。'}</Text>
      {!authorized ? (
        <View style={{ marginTop: '28px', padding: '30px 24px', borderRadius: '20px', background: '#e6f3f3', border: '1px solid #cde6e7' }}>
          <Text style={{ display: 'block', color: '#0f7f83', fontSize: '30px', fontWeight: '800' }}>公开视频已锁定</Text>
          <Text style={{ display: 'block', marginTop: '10px', color: '#627577', fontSize: '24px', lineHeight: 1.6 }}>输入学习通行码后，可以按人体解剖学、生理学、临床医学概论、临床技能操作查看对应讲解。</Text>
          <View onTap={() => Taro.navigateTo({ url: '/pages/activate/index' })} style={{ width: '170px', height: '56px', marginTop: '20px', borderRadius: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#138b8f' }}>
            <Text style={{ color: '#fff', fontSize: '25px', fontWeight: '800' }}>去激活</Text>
          </View>
        </View>
      ) : data.length === 0 ? (
        <View style={{ marginTop: '40px', padding: '36px 24px', borderRadius: '20px', background: '#fff', textAlign: 'center' }}>
          <Text style={{ color: '#8a989a', fontSize: '26px' }}>暂无已发布公开视频</Text>
        </View>
      ) : data.map((video) => (
        <VideoItem key={video.id} video={video} active={activeVideoId === video.id} onPlay={() => setActiveVideoId(video.id)} />
      ))}
    </View>
  )
}
