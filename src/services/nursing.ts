import Taro from '@tarojs/taro'
import { IS_WEAPP, MINIAPP_ENV } from '@/config/env'
import {
  practiceHomeMock,
  profileMock,
  questionBankMock,
  questionDetailMock,
} from '@/mock/nursing'
import type {
  AuthorizationInfo,
  AuthorizationStatus,
  ConfusingPointSummary,
  Difficulty,
  KnowledgePointTag,
  NursingKnowledgeCard,
  PracticeHomeOverview,
  PracticeQuestionSummary,
  ProfileOverview,
  QuestionBankOverview,
  QuestionCatalogItem,
  QuestionDetail,
  QuestionOption,
  QuestionType,
  VideoLessonSummary,
} from '@/types/study'

const OPEN_ID_STORAGE_KEY = 'cfqh_open_id'
const TOKEN_STORAGE_KEY = 'cfqh_token_code'

const lockedAuthorization: AuthorizationInfo = {
  status: 'unauthorized',
  tokenCode: '',
  expiresText: '输入学习通行码后解锁',
  resourceScopeText: '医护题库、解析、案例材料、公开讲解',
}

const lockedCatalog: QuestionCatalogItem[] = [
  { moduleCode: 'anatomy', moduleName: '人体解剖学', chapter: '人体解剖学', chapterSort: 1, subChapterCount: 12, mockChapters: ['运动系统', '消化系统', '神经系统'], totalQuestions: 0, totalVideos: 0, completedQuestions: 0, completionRate: 0, difficultyLabel: '待解锁', locked: true, iconText: '解' },
  { moduleCode: 'physiology', moduleName: '生理学', chapter: '生理学', chapterSort: 2, subChapterCount: 10, mockChapters: ['细胞生理', '血液', '循环系统'], totalQuestions: 0, totalVideos: 0, completedQuestions: 0, completionRate: 0, difficultyLabel: '待解锁', locked: true, iconText: '生' },
  { moduleCode: 'clinical_medicine', moduleName: '临床医学概论', chapter: '临床医学概论', chapterSort: 3, subChapterCount: 11, mockChapters: ['症状学', '呼吸系统疾病', '脑血管疾病'], totalQuestions: 0, totalVideos: 0, completedQuestions: 0, completionRate: 0, difficultyLabel: '待解锁', locked: true, iconText: '临' },
  { moduleCode: 'clinical_skills', moduleName: '临床技能操作', chapter: '临床技能操作', chapterSort: 4, subChapterCount: 6, mockChapters: ['技能一', '技能二', '技能三'], totalQuestions: 0, totalVideos: 0, completedQuestions: 0, completionRate: 0, difficultyLabel: '待解锁', locked: true, iconText: '技' },
]

export function isAuthorized(authorization?: Pick<AuthorizationInfo, 'status'> | AuthorizationStatus | null) {
  const status = typeof authorization === 'string' ? authorization : authorization?.status
  return status === 'authorized'
}

export function getLockedPracticeHomeOverview(): PracticeHomeOverview {
  return {
    ...practiceHomeMock,
    authorization: lockedAuthorization,
    progress: { done: 0, total: 0, percent: 0 },
    todayProblem: {
      id: 'locked-question',
      title: '激活后查看今日练习',
      stem: '激活后查看今日练习',
      type: 'single_choice',
      difficulty: 'basic',
      difficultyText: '待解锁',
      knowledgePoints: [],
      estimatedMinutes: 0,
      chapter: '医护大类',
    },
    dailyQuestion: undefined,
    continueQuestion: undefined,
    recommendedQuestions: [],
    recentMistakes: [],
    recommendedVideos: [],
    knowledgeCards: [],
    confusingPoints: [],
    weeklyCompletedCount: 0,
    suggestion: '输入学习通行码后解锁完整题库、解析、错题和公开讲解。',
  }
}

function getEmptyAuthorizedPracticeQuestion(): PracticeQuestionSummary {
  return {
    id: '',
    title: '暂无已发布题目',
    stem: '当前账号已授权，但后端没有返回可练习题目。',
    type: 'single_choice',
    difficulty: 'basic',
    difficultyText: '待同步',
    knowledgePoints: [],
    estimatedMinutes: 0,
    chapter: '题库同步',
  }
}

export function getLockedQuestionBankOverview(): QuestionBankOverview {
  return {
    ...questionBankMock,
    authorization: lockedAuthorization,
    catalog: lockedCatalog,
    questions: [],
  }
}

interface ApiQuestion {
  id: string
  title: string
  stem: string
  type: QuestionType
  difficulty: Difficulty
  knowledgeTags: string
  chapter?: string
  options?: QuestionOption[]
  answer?: string
  analysis?: string
  progress?: { current: number; total: number }
  nextQuestionId?: string | null
  completed?: boolean
  isFavorite?: boolean
  isMistake?: boolean
  inMistakeBook?: boolean
  wrongCount?: number
  caseMaterial?: {
    id: string
    title: string
    background: string
    keywords: string
    analysisFocus: string
  } | null
  confusingPoint?: {
    id: string
    title: string
    leftConcept: string
    rightConcept: string
    contrastSummary: string
  } | null
  memoryTip?: {
    id: string
    title: string
    tip: string
  } | null
  relatedVideo?: {
    id: string
    title: string
    duration: number
    coverUrl?: string
    videoUrl?: string
  } | null
}

interface ApiPracticeHome {
  subjectCode: 'nursing'
  subjectName: string
  authorization?: { status: string }
  progress?: { done: number; total: number; percent: number }
  weeklyCompletedCount?: number
  continueQuestion?: ApiQuestion | null
  dailyQuestion?: ApiQuestion | null
  recommendedQuestions?: ApiQuestion[]
  dailyPractice?: { questionId?: string; questionTitle: string; knowledgeTags: string } | null
  recentMistakes?: Array<ApiQuestion & { wrongCount?: number }>
  recommendedVideos?: unknown[]
  confusingPoints?: Array<{ id: string; title: string; contrastSummary: string }>
  memoryTips?: Array<{ id: string; title: string; tip: string; relatedKnowledgeTags: string }>
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE'
  data?: Record<string, unknown>
  header?: Record<string, string>
  authRequired?: boolean
}

type LoginResponse = {
  openId?: string
  nickname?: string
  avatarUrl?: string
}

export type LicenseStatusResult = {
  authorized: boolean
  reason?: string
  authorization?: { expiresAt?: string; licenseToken?: { code?: string } }
}

function getOpenId() {
  if (MINIAPP_ENV.skipWechatLogin && MINIAPP_ENV.devOpenId) return MINIAPP_ENV.devOpenId
  return Taro.getStorageSync<string>(OPEN_ID_STORAGE_KEY) || ''
}

function getTokenCode() {
  return Taro.getStorageSync<string>(TOKEN_STORAGE_KEY) || MINIAPP_ENV.devTokenCode
}

function appendOpenIdQuery(path: string, openId?: string) {
  if (!openId) return path
  const [pathWithoutHash, hash = ''] = path.split('#')
  if (/(^|[?&])openId=/.test(pathWithoutHash)) return path
  const separator = pathWithoutHash.includes('?') ? '&' : '?'
  return `${pathWithoutHash}${separator}openId=${encodeURIComponent(openId)}${hash ? `#${hash}` : ''}`
}

function getClientLoginPayload() {
  let systemInfo = {} as Record<string, unknown>
  try {
    systemInfo = Taro.getSystemInfoSync?.() as unknown as Record<string, unknown>
  } catch {
    systemInfo = {}
  }

  return {
    clientEnv: IS_WEAPP ? 'weapp' : MINIAPP_ENV.platform,
    platform: String(systemInfo.platform || ''),
    device: [systemInfo.brand, systemInfo.model].filter(Boolean).join(' '),
    sdkVersion: String(systemInfo.SDKVersion || ''),
    appVersion: String(systemInfo.version || ''),
    source: 'miniapp',
  }
}

async function getWechatLoginCode() {
  if (!IS_WEAPP || !Taro.login) return ''
  try {
    const result = await Taro.login()
    return result.code || ''
  } catch (error) {
    console.warn('wx login failed', error)
    return ''
  }
}

export class RequestError extends Error {
  statusCode: number
  reason: string
  constructor(statusCode: number, reason: string, path: string) {
    super(`[${statusCode}] ${reason} (${path})`)
    this.statusCode = statusCode
    this.reason = reason
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
  try {
    if (MINIAPP_ENV.useCloudGateway && IS_WEAPP) {
      if (!Taro.cloud?.callFunction) {
        console.warn(`cloud gateway unavailable: ${path}`)
        return null
      }

      const response = await Taro.cloud.callFunction({
        name: MINIAPP_ENV.cloudGatewayName,
        data: {
          path,
          method: options.method || 'GET',
          data: options.data,
        },
      })
      const result = response.result as { ok?: boolean; data?: T; error?: string; statusCode?: number } | T | undefined
      if (result && typeof result === 'object' && 'ok' in result) {
        if (!result.ok) {
          console.warn(`[cfqh-cloud] ${path} failed:`, result.error, result.statusCode ? `(${result.statusCode})` : '')
          return null
        }
        return result.data ?? null
      }
      return (result as T) ?? null
    }

    const openId = getOpenId()
    const requestPath = appendOpenIdQuery(path, openId)
    const apiBases = Array.from(new Set([MINIAPP_ENV.apiBase, ...MINIAPP_ENV.apiFallbackBases].filter(Boolean)))
    for (const apiBase of apiBases) {
      try {
        if (MINIAPP_ENV.debugApi) console.info(`[cfqh-api] ${options.method || 'GET'} ${apiBase}${requestPath}`)
        const response = await Taro.request<T>({
          url: `${apiBase}${requestPath}`,
          method: options.method || 'GET',
          data: options.data,
          timeout: 8000,
          header: {
            'content-type': 'application/json',
            ...(openId ? { 'x-open-id': openId } : {}),
            ...(options.header || {}),
          },
        })
        if (MINIAPP_ENV.debugApi) console.info(`[cfqh-api] ${response.statusCode} ${requestPath}`)

        if (response.statusCode >= 200 && response.statusCode < 300) {
          return response.data
        }

        const reason = (response.data as any)?.message || (response.data as any)?.error || `HTTP ${response.statusCode}`
        if (response.statusCode === 401) {
          console.warn(`[cfqh-api] 401 Unauthorized: ${requestPath} — openId 可能无效或未传递`)
        } else if (response.statusCode === 403) {
          console.warn(`[cfqh-api] 403 Forbidden: ${requestPath} — 授权不足或 token 过期`)
        } else if (response.statusCode === 404) {
          console.warn(`[cfqh-api] 404 Not Found: ${requestPath} — 接口不存在或资源已删除`)
        } else {
          console.warn(`[cfqh-api] ${response.statusCode}: ${requestPath}`, reason)
        }
        if (response.statusCode < 500) return null
      } catch (error) {
        console.warn(`request failed: ${requestPath}`, error)
      }
    }

    return null
  } catch (error) {
    console.warn(`request failed: ${path}`, error)
    return null
  }
}

async function loginMiniappUser(profile?: { nickname?: string; avatarUrl?: string }) {
  const openId = getOpenId()
  if (MINIAPP_ENV.skipWechatLogin && openId && !profile) {
    Taro.setStorageSync(OPEN_ID_STORAGE_KEY, openId)
    return openId
  }

  const code = await getWechatLoginCode()
  const result = await request<LoginResponse>('/auth/wechat-login', {
    method: 'POST',
    data: {
      ...(code ? { code } : {}),
      ...(openId ? { openId } : {}),
      ...(profile?.nickname ? { nickname: profile.nickname } : {}),
      ...(profile?.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
      ...getClientLoginPayload(),
    },
  })
  const resolvedOpenId = result?.openId || openId
  if (resolvedOpenId) Taro.setStorageSync(OPEN_ID_STORAGE_KEY, resolvedOpenId)
  return resolvedOpenId
}

async function ensureLogin() {
  return loginMiniappUser()
}

export async function loginWithWechatProfile() {
  const getUserProfile = (Taro as unknown as { getUserProfile?: (options: { desc: string }) => Promise<{ userInfo?: { nickName?: string; avatarUrl?: string } }> }).getUserProfile
  if (!getUserProfile) {
    await loginMiniappUser()
    return { ok: true, nickname: '微信用户', avatarUrl: '', profileSynced: false }
  }

  let result: { userInfo?: { nickName?: string; avatarUrl?: string } }
  try {
    result = await getUserProfile({ desc: '用于展示学习账号头像昵称与同步登录台账' })
  } catch (error) {
    await loginMiniappUser()
    return { ok: false, cancelled: true, nickname: '微信用户', avatarUrl: '' }
  }
  const userInfo = result.userInfo || {}
  await loginMiniappUser({
    nickname: userInfo.nickName || '微信用户',
    avatarUrl: userInfo.avatarUrl || '',
  })
  return { ok: true, nickname: userInfo.nickName || '微信用户', avatarUrl: userInfo.avatarUrl || '', profileSynced: true }
}

function difficultyText(difficulty?: string) {
  if (difficulty === 'advanced') return '较难'
  if (difficulty === 'medium') return '中等'
  return '基础'
}

function mapKnowledgeTags(tags?: string): KnowledgePointTag[] {
  return String(tags || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, index) => ({ id: `kp-${index}-${name}`, name }))
}

function normalizeQuestion(input: Partial<ApiQuestion> & { knowledgePoints?: KnowledgePointTag[]; estimatedMinutes?: number }): PracticeQuestionSummary {
  const difficulty = (input.difficulty || 'basic') as Difficulty
  return {
    id: input.id || 'question-fallback',
    title: input.title || '待补充题目',
    stem: input.stem || input.title || '待补充题干',
    type: (input.type || 'single_choice') as QuestionType,
    difficulty,
    difficultyText: difficultyText(difficulty),
    knowledgePoints: input.knowledgePoints || mapKnowledgeTags(input.knowledgeTags),
    options: Array.isArray(input.options) ? input.options : undefined,
    estimatedMinutes: input.estimatedMinutes || 5,
    completed: Boolean(input.completed),
    isFavorite: Boolean(input.isFavorite),
    isMistake: Boolean(input.isMistake || input.inMistakeBook || (input.wrongCount && input.wrongCount > 0)),
    wrongCount: input.wrongCount || 0,
    chapter: input.chapter,
  }
}

function normalizeAuthorization(result?: LicenseStatusResult | null): AuthorizationInfo {
  const authorized = Boolean(result?.authorized)
  return {
    status: authorized ? 'authorized' : 'unauthorized',
    tokenCode: authorized ? result?.authorization?.licenseToken?.code || getTokenCode() : '',
    expiresText: result?.authorization?.expiresAt ? `有效期至 ${String(result.authorization.expiresAt).slice(0, 10)}` : '已激活后可使用完整资源',
    resourceScopeText: '医护题库、解析、案例材料、公开讲解',
    reason: result?.reason,
  }
}

export async function activateLicense(code: string) {
  const openId = await ensureLogin()
  const result = await request<LicenseStatusResult>('/license/activate', {
    method: 'POST',
    data: { ...(openId ? { openId } : {}), code, ...getClientLoginPayload() },
  })

  if (result?.authorized) {
    Taro.setStorageSync(TOKEN_STORAGE_KEY, result.authorization?.licenseToken?.code || code)
    return result
  }

  if (MINIAPP_ENV.skipWechatLogin && result?.reason === 'bound_to_other_account') {
    const status = await getLicenseStatus()
    if (status.authorized) {
      Taro.setStorageSync(TOKEN_STORAGE_KEY, status.authorization?.licenseToken?.code || code)
      return status
    }
  }

  return result
}

export function getLocalPracticeHomeOverview(): PracticeHomeOverview {
  return getLockedPracticeHomeOverview()
}

export function getLocalQuestionBankOverview(): QuestionBankOverview {
  return getLockedQuestionBankOverview()
}

export function getLocalQuestionDetail(id?: string): QuestionDetail {
  return questionDetailMock[id || ''] ?? questionDetailMock['q-001']
}

export async function getLicenseStatus() {
  const openId = await ensureLogin()
  const query = openId ? `?openId=${encodeURIComponent(openId)}` : ''
  const result = await request<LicenseStatusResult>(`/license/status${query}`)
  return result || { authorized: false, reason: 'request_failed' }
}

export async function getPracticeHomeOverview(): Promise<PracticeHomeOverview> {
  const licenseStatus = await getLicenseStatus()

  if (!licenseStatus.authorized) {
    return {
      ...getLockedPracticeHomeOverview(),
      authorization: normalizeAuthorization(licenseStatus),
    }
  }

  const home = await request<ApiPracticeHome>('/practice-home')

  if (!home) {
    if (!MINIAPP_ENV.useMockFallback) throw new Error('practice_home_request_failed')
    return {
      ...practiceHomeMock,
      authorization: normalizeAuthorization(licenseStatus),
    }
  }

  const normalizedRecommendedQuestions = (home.recommendedQuestions || [])
    .map(normalizeQuestion)

  const dailyQuestion = home.dailyQuestion ? normalizeQuestion(home.dailyQuestion) : normalizedRecommendedQuestions[0]
  const continueQuestion = home.continueQuestion ? normalizeQuestion(home.continueQuestion) : dailyQuestion
  const recommendedQuestions = normalizedRecommendedQuestions
    .filter((question) => question.id !== continueQuestion?.id)
  if (recommendedQuestions.length === 0 && dailyQuestion) {
    recommendedQuestions.push(dailyQuestion)
  }
  const recentMistakes = home.recentMistakes?.map((item) => ({ ...normalizeQuestion(item), isMistake: true, wrongCount: item.wrongCount || 1 })) || []
  const recommendedVideos: VideoLessonSummary[] = []
  const confusingPoints: ConfusingPointSummary[] = home.confusingPoints?.map((item) => ({ id: item.id, title: item.title, contrast: item.contrastSummary })) || []
  const knowledgeCards: NursingKnowledgeCard[] = home.memoryTips?.map((item) => ({
    id: item.id,
    title: item.title,
    summary: `关联知识点：${item.relatedKnowledgeTags}`,
    keywords: item.relatedKnowledgeTags.split(',').filter(Boolean),
    memoryTip: item.tip,
  })) || []
  const todayProblem = dailyQuestion || continueQuestion || recommendedQuestions[0] || getEmptyAuthorizedPracticeQuestion()

  return {
    ...practiceHomeMock,
    subjectName: home.subjectName || '医护大类',
    authorization: normalizeAuthorization(licenseStatus),
    progress: home.progress || practiceHomeMock.progress,
    weeklyCompletedCount: home.weeklyCompletedCount ?? 0,
    todayProblem,
    dailyQuestion,
    continueQuestion,
    recommendedQuestions: recommendedQuestions.slice(0, 5),
    recentMistakes,
    recommendedVideos,
    confusingPoints,
    knowledgeCards,
  }
}

export async function getQuestionBankOverview(knownLicenseStatus?: LicenseStatusResult | null): Promise<QuestionBankOverview> {
  const licenseStatus = knownLicenseStatus || await getLicenseStatus()
  const catalog = await request<QuestionCatalogItem[]>('/catalog')

  if (!licenseStatus.authorized) {
    return {
      ...getLockedQuestionBankOverview(),
      authorization: normalizeAuthorization(licenseStatus),
      catalog: Array.isArray(catalog) && catalog.length > 0 ? catalog.map((item) => ({
        ...item,
        locked: true,
        totalQuestions: 0,
        totalVideos: 0,
        completedQuestions: 0,
        completionRate: 0,
        difficultyLabel: '待解锁',
        iconText: item.iconText || '题',
      })) : getLockedQuestionBankOverview().catalog,
    }
  }

  const authorization = normalizeAuthorization(licenseStatus)

  const catalogLockedByServer = Array.isArray(catalog) && catalog.length > 0 && catalog.every((item) => Boolean(item.locked))
  if (!catalog || catalog.length === 0 || catalogLockedByServer) {
    console.warn('[QuestionBank] authorized but catalog empty/locked — possible openId mismatch or backend issue', { authorized: licenseStatus.authorized, catalogLength: catalog?.length, allLocked: catalogLockedByServer })
    return {
      ...questionBankMock,
      authorization,
      catalog: catalog?.length ? catalog.map((item) => ({ ...item, locked: true, iconText: item.iconText || '题' })) : [],
      questions: [],
      _diagnostic: 'authorized_but_catalog_unavailable',
    } as QuestionBankOverview
  }

  return {
    ...questionBankMock,
    authorization,
    catalog: catalog.map((item) => ({
      ...item,
      locked: false,
      iconText: item.iconText || '题',
    })),
  }
}

export async function getQuestionDetail(id: string): Promise<QuestionDetail> {
  const detail = await request<ApiQuestion>(`/questions/${id}`)
  if (!detail) {
    if (!MINIAPP_ENV.useMockFallback) throw new Error('question_detail_request_failed')
    return getLocalQuestionDetail(id)
  }

  return {
    id: detail.id,
    title: detail.title,
    stem: detail.stem,
    type: detail.type,
    difficulty: detail.difficulty,
    difficultyText: difficultyText(detail.difficulty),
    knowledgePoints: mapKnowledgeTags(detail.knowledgeTags),
    options: detail.options || [],
    answer: detail.answer || '',
    analysis: detail.analysis || '',
    progress: detail.progress || { current: 1, total: 1 },
    nextQuestionId: detail.nextQuestionId,
    caseMaterial: detail.caseMaterial
      ? {
          id: detail.caseMaterial.id,
          title: detail.caseMaterial.title,
          background: detail.caseMaterial.background,
          keywords: detail.caseMaterial.keywords.split(',').filter(Boolean),
          analysisFocus: detail.caseMaterial.analysisFocus.split(';').filter(Boolean),
        }
      : undefined,
    confusingPoint: detail.confusingPoint || undefined,
    memoryTip: detail.memoryTip || undefined,
    relatedVideo: detail.relatedVideo || undefined,
    isFavorite: Boolean(detail.isFavorite),
    inMistakeBook: Boolean(detail.inMistakeBook),
    wrongCount: detail.wrongCount || 0,
  }
}

export async function getProfileOverview(): Promise<ProfileOverview> {
  const licenseStatus = await getLicenseStatus()
  const authorization = normalizeAuthorization(licenseStatus)

  if (!licenseStatus.authorized) {
    return {
      ...profileMock,
      authorization,
      practiceCount: 0,
      mistakeCount: 0,
      favoriteCount: 0,
    }
  }

  const [me, mistakes] = await Promise.all([
    request<{ nickname?: string; avatarUrl?: string; authorization?: { licenseToken?: { code: string }; expiresAt?: string } }>('/auth/me'),
    request<Array<{ id: string }>>('/mistakes'),
  ])

  if (!me) return { ...profileMock, authorization }

  return {
    ...profileMock,
    nickname: me.nickname || '医护同学',
    avatarUrl: me.avatarUrl,
    authorization: {
      ...authorization,
      tokenCode: me.authorization?.licenseToken?.code || getTokenCode(),
      expiresText: me.authorization?.expiresAt ? `有效期至 ${String(me.authorization.expiresAt).slice(0, 10)}` : authorization.expiresText,
    },
    mistakeCount: mistakes?.length ?? profileMock.mistakeCount,
  }
}

export async function getMyMistakes() {
  return request<Array<{ id: string; questionId: string; wrongCount: number; lastWrongAt?: string; question?: { id: string; title: string; chapter?: string; moduleName?: string } }>>('/mistakes')
}

export async function getMyFavorites() {
  return request<Array<{ id: string; questionId: string; question?: { id: string; title: string; chapter?: string; moduleName?: string } }>>('/favorites')
}

export async function removeFavorite(questionId: string) {
  return request(`/favorites?questionId=${questionId}`, { method: 'DELETE' })
}

export async function getMyReport() {
  return request<{ totalPractice: number; correctRate: number; practiceDays: number; uniqueQuestions: number; mistakeCount: number; favoriteCount: number; weeklyActiveDays: number; weeklyPracticeCount: number }>('/my/report')
}

export async function getReviewToday() {
  return request<{ count: number; questions: Array<{ id: string; title: string; chapter?: string; moduleName?: string; wrongCount: number }> }>('/my/review-today')
}

export interface LearningReportData {
  summary: { totalPractice: number; correctRate: number; practiceDays: number; weeklyCount: number; weeklyDays: number; mistakeCount: number; favoriteCount: number }
  trend: Array<{ date: string; count: number; correctRate: number }>
  moduleProgress: Array<{ moduleCode: string; moduleName: string; totalQuestions: number; doneQuestions: number; completionRate: number; correctRate: number }>
  weakChapters: Array<{ chapter: string; moduleName: string; count: number }>
  reviewCount: number
  recommendation: string
  recommendAction: string
}

export async function getLearningReport(range: '7d' | '30d' | 'all' = '7d') {
  return request<LearningReportData>(`/my/learning-report?range=${range}`)
}

export async function submitPracticeRecord(questionId: string, isCorrect: boolean, submittedAnswer?: string, progress?: { current?: number; total?: number }, extra?: { durationMs?: number; sessionId?: string; selectedOption?: string; reviewFrequency?: string }) {
  const openId = await ensureLogin()
  return request('/practice-records', {
    method: 'POST',
    data: {
      ...(openId ? { openId } : {}),
      questionId,
      isCorrect,
      submittedAnswer,
      practiceMode: 'daily',
      sequenceNo: progress?.current,
      totalCount: progress?.total,
      durationMs: extra?.durationMs,
      sessionId: extra?.sessionId,
      selectedOption: extra?.selectedOption,
      reviewFrequency: extra?.reviewFrequency,
    },
  })
}

export async function getModuleQuestions(moduleCode: string): Promise<PracticeQuestionSummary[]> {
  const moduleQuestions = await request<ApiQuestion[]>(`/modules/${moduleCode}/questions`)
  if (!moduleQuestions) {
    if (!MINIAPP_ENV.useMockFallback) throw new Error('module_questions_request_failed')
    return []
  }
  if (moduleQuestions.length === 0) return []

  return moduleQuestions.map((question) => normalizeQuestion(question))
}

export async function addFavorite(questionId: string) {
  const openId = await ensureLogin()
  return request('/favorites', {
    method: 'POST',
    data: { ...(openId ? { openId } : {}), questionId },
  })
}

export async function getRanking(type: string) {
  const result = await request<{ list: Array<{ openId: string; nickname: string; value: number }>; me?: { rank: number; value: number } }>(`/ranking?type=${type}`)
  return result || { list: [], me: null }
}

export interface HomeConfig {
  notice?: string
  dailyQuote?: string
  examCountdown?: number
  aboutText?: string
}

export async function getHomeConfig(): Promise<HomeConfig> {
  const result = await request<HomeConfig>('/home-config')
  return result || {}
}

// ─── Exam Module ──────────────────────────────────────────────────────────────

export interface ExamJoinResult {
  sessionId: string
  exam: { id: string; title: string; durationMin: number; totalScore: number }
  startedAt: string
  deadline: string
}

export interface ExamSessionInfo {
  sessionId: string
  exam: { id: string; title: string; durationMin: number; totalScore: number }
  startedAt: string
  deadline: string
  status?: 'in_progress' | 'submitted' | 'graded'
}

export interface ExamQuestionItem {
  id: string
  seq: number
  type: string
  stem: string
  optionsJson: string
  score: number
  isObjective: boolean
  savedAnswer: string | null
}

export interface ExamResultInfo {
  published: boolean
  examTitle: string
  totalScore?: number | null
  objectiveScore?: number | null
  subjectiveScore?: number | null
  rank?: number | null
  totalStudents?: number
  hideCount?: number
  comment?: string | null
  status?: string
  answers?: Array<{
    questionId: string
    seq: number
    stem: string
    type: string
    yourAnswer: string | null
    correctAnswer: string
    isCorrect: boolean | null
    score: number | null
    maxScore: number
    analysis: string | null
  }>
}

export interface ExamHistoryItem {
  id: string
  examId: string
  status: string
  totalScore: number | null
  rank: number | null
  createdAt: string
  exam: { id: string; title: string; status: string; totalScore: number }
}

export async function joinExam(code: string): Promise<ExamJoinResult> {
  const openId = await ensureLogin()
  const result = await request<ExamJoinResult>('/exams/join', {
    method: 'POST',
    data: { ...(openId ? { openId } : {}), code },
  })
  if (!result) throw new Error('join_exam_failed')
  return result
}

export async function getActiveExamSession(): Promise<ExamSessionInfo | null> {
  const openId = await ensureLogin()
  return request<ExamSessionInfo>(`/exams/active${openId ? `?openId=${openId}` : ''}`)
}

export async function getExamSessionInfo(sessionId: string): Promise<ExamSessionInfo | null> {
  const openId = await ensureLogin()
  const result = await request<ExamSessionInfo>(`/exams/${sessionId}/info${openId ? `?openId=${openId}` : ''}`)
  if (!result) throw new Error('加载考试失败')
  return result
}

export async function getExamQuestions(sessionId: string): Promise<ExamQuestionItem[]> {
  const openId = await ensureLogin()
  const result = await request<ExamQuestionItem[]>(`/exams/${sessionId}/questions${openId ? `?openId=${openId}` : ''}`)
  if (!result) throw new Error('加载题目失败')
  return result
}

export async function submitExamAnswer(sessionId: string, questionId: string, answer: string) {
  const openId = await ensureLogin()
  const result = await request<{ ok: boolean }>(`/exams/${sessionId}/answer`, {
    method: 'POST',
    data: { ...(openId ? { openId } : {}), questionId, answer },
  })
  if (!result?.ok) throw new Error('答案保存失败')
  return result
}

export async function submitExam(sessionId: string) {
  const openId = await ensureLogin()
  const result = await request<{ ok: boolean }>(`/exams/${sessionId}/submit`, {
    method: 'POST',
    data: { ...(openId ? { openId } : {}) },
  })
  if (!result?.ok) throw new Error('交卷失败')
  return result
}

export async function reportExamHideEvent(sessionId: string, durationMs: number) {
  const openId = await ensureLogin()
  return request(`/exams/${sessionId}/hide-event`, {
    method: 'POST',
    data: { ...(openId ? { openId } : {}), durationMs },
  })
}

export async function getExamResult(sessionId: string): Promise<ExamResultInfo> {
  const openId = await ensureLogin()
  const result = await request<ExamResultInfo>(`/exams/${sessionId}/result${openId ? `?openId=${openId}` : ''}`)
  if (!result) throw new Error('exam_result_request_failed')
  return result
}

export interface LeaderboardEntry {
  rank: number
  nickname: string
  avatarUrl: string | null
  totalScore: number
  objectiveScore: number
  durationMs: number | null
  durationText: string | null
  correctRate: number | null
}

export interface LeaderboardResult {
  published: boolean
  leaderboard: LeaderboardEntry[]
}

export async function getExamLeaderboard(sessionId: string): Promise<LeaderboardResult> {
  const openId = await ensureLogin()
  const result = await request<LeaderboardResult>(`/exams/${sessionId}/leaderboard${openId ? `?openId=${openId}` : ''}`)
  return result || { published: false, leaderboard: [] }
}

export async function getExamHistory(): Promise<ExamHistoryItem[]> {
  const openId = await ensureLogin()
  const result = await request<ExamHistoryItem[]>(`/exams/history${openId ? `?openId=${openId}` : ''}`)
  return result || []
}
