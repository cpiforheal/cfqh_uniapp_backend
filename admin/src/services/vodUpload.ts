import { adminFetch } from './adminApi'

const VOD_SDK_URL = 'https://cdn-go.cn/cdn/vod-js-sdk-v6/latest/vod-js-sdk-v6.js'

type VodUploadSignature = {
  signature: string
}

export type VodUploadResult = {
  fileId: string
  videoUrl: string
  coverUrl?: string
}

declare global {
  interface Window {
    TcVod?: any
  }
}

let sdkLoadPromise: Promise<void> | undefined

function loadVodSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('当前环境不支持浏览器上传'))
  if (window.TcVod) return Promise.resolve()
  if (sdkLoadPromise) return sdkLoadPromise

  sdkLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${VOD_SDK_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('腾讯云 VOD 上传 SDK 加载失败')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = VOD_SDK_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('腾讯云 VOD 上传 SDK 加载失败'))
    document.head.appendChild(script)
  })

  return sdkLoadPromise
}

async function getUploadSignature() {
  const data = await adminFetch<VodUploadSignature>('/admin/vod/upload-signature', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return data.signature
}

function normalizePercent(percent: unknown) {
  const value = Number(percent)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value > 1 ? value : value * 100)))
}

export async function uploadVideoToVod(file: File, onProgress?: (percent: number) => void): Promise<VodUploadResult> {
  await loadVodSdk()
  const TcVod = window.TcVod?.default || window.TcVod
  if (!TcVod) throw new Error('未检测到腾讯云 VOD 上传 SDK')

  const tcVod = new TcVod({
    getSignature: getUploadSignature,
  })
  const uploader = tcVod.upload({
    mediaFile: file,
    mediaName: file.name.replace(/\.[^.]+$/, ''),
  })
  uploader.on('media_progress', (info: { percent?: number }) => onProgress?.(normalizePercent(info?.percent)))

  const result = await uploader.done()
  const fileId = String(result?.fileId || '')
  const videoUrl = String(result?.video?.url || result?.videoUrl || '')
  const coverUrl = result?.cover?.url || result?.coverUrl
  if (!fileId || !videoUrl) {
    throw new Error('VOD 上传已返回，但未拿到 fileId 或播放地址')
  }

  onProgress?.(100)
  return { fileId, videoUrl, coverUrl }
}
