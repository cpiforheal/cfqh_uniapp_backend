import type {
  CaseMaterial,
  ConfusingPoint,
  DailyProblem,
  KnowledgePoint,
  MemoryTip,
  Problem,
  ReviewItem,
  SubjectCode,
  VideoAsset,
  VideoLesson,
} from '@/types/content'
import { getNursingList } from '@/services/nursingContent'
import { getCurrentSubjectCode } from '@/services/subjects'

function currentSubjectFilter<T extends { subjectCode: SubjectCode }>(items: T[]) {
  const subjectCode = getCurrentSubjectCode()
  if (subjectCode === 'nursing') {
    return getNursingContentByKind(subjectCode, items)
  }
  return items.filter((item) => item.subjectCode === subjectCode)
}

function getNursingContentByKind<T extends { subjectCode: SubjectCode }>(
  subjectCode: SubjectCode,
  fallbackItems: T[],
): T[] {
  if (subjectCode !== 'nursing' || fallbackItems.length === 0) {
    return fallbackItems.filter((item) => item.subjectCode === subjectCode)
  }

  const sample = fallbackItems[0]

  if ('leftConcept' in sample) return getNursingList('confusingPoints') as unknown as T[]
  if ('tip' in sample) return getNursingList('memoryTips') as unknown as T[]
  if ('background' in sample) return getNursingList('caseMaterials') as unknown as T[]
  if ('answer' in sample && 'type' in sample) return getNursingList('problems') as unknown as T[]
  if ('sort' in sample) return getNursingList('knowledgePoints') as unknown as T[]

  return fallbackItems.filter((item) => item.subjectCode === subjectCode)
}

export const knowledgePoints: KnowledgePoint[] = [
  { subjectCode: 'math', id: 'kp-001', name: '函数极限', chapter: '第一章 函数、极限与连续', sort: 1, status: 'published', updatedAt: '2026-05-05' },
  { subjectCode: 'math', id: 'kp-002', name: '导数定义', chapter: '第二章 一元函数微分学', sort: 2, status: 'published', updatedAt: '2026-05-05' },
  { subjectCode: 'math', id: 'kp-003', name: '定积分应用', chapter: '第四章 一元函数积分学', sort: 3, status: 'draft', updatedAt: '2026-05-05' },
  { subjectCode: 'nursing', id: 'n-kp-001', name: '生命体征观察', chapter: '护理学基础', sort: 1, status: 'published', updatedAt: '2026-05-06' },
]

export const problems: Problem[] = [
  { subjectCode: 'math', id: 'p-001', title: '函数极限基础判断', type: 'solution', difficulty: 'basic', knowledgeTags: ['函数极限'], answer: '极限存在', source: '自建题库', status: 'published', updatedAt: '2026-05-05' },
  { subjectCode: 'math', id: 'p-002', title: '导数定义计算', type: 'blank', difficulty: 'medium', knowledgeTags: ['导数定义'], answer: '2', source: '公开讲义整理', status: 'draft', updatedAt: '2026-05-05' },
  { subjectCode: 'nursing', id: 'n-p-001', title: '生命体征观察要点', type: 'single_choice', difficulty: 'basic', knowledgeTags: ['生命体征', '病情观察'], answer: '观察体温、脉搏、呼吸、血压及变化趋势', source: '医护知识点整理', status: 'published', updatedAt: '2026-05-06' },
]

export const dailyProblems: DailyProblem[] = [
  { subjectCode: 'math', id: 'dp-001', date: '2026-05-05', problemTitle: '函数极限基础判断', knowledgeTags: ['函数极限'], status: 'published', updatedAt: '2026-05-05' },
  { subjectCode: 'math', id: 'dp-002', date: '2026-05-06', problemTitle: '导数定义计算', knowledgeTags: ['导数定义'], status: 'draft', updatedAt: '2026-05-05' },
  { subjectCode: 'nursing', id: 'n-dp-001', date: '2026-05-06', problemTitle: '生命体征观察要点', knowledgeTags: ['生命体征'], status: 'published', updatedAt: '2026-05-06' },
]

export const videoLessons: VideoLesson[] = [
  { subjectCode: 'math', id: 'v-001', title: '函数极限公开讲解', duration: 12, difficulty: 'basic', knowledgeTags: ['函数极限'], status: 'published', updatedAt: '2026-05-05' },
  { subjectCode: 'math', id: 'v-002', title: '导数定义例题讲解', duration: 16, difficulty: 'medium', knowledgeTags: ['导数定义'], status: 'draft', updatedAt: '2026-05-05' },
  { subjectCode: 'nursing', id: 'n-v-001', title: '生命体征观察公开讲解', duration: 10, difficulty: 'basic', knowledgeTags: ['生命体征'], status: 'published', updatedAt: '2026-05-06' },
]

export const videoAssets: VideoAsset[] = [
  { subjectCode: 'math', id: 'a-001', filename: 'limit-basic-demo.mp4', fileKey: 'mock/video/limit-basic-demo.mp4', sizeMB: 128, source: 'mock', status: 'published', updatedAt: '2026-05-05' },
  { subjectCode: 'math', id: 'a-002', filename: 'derivative-intro.mp4', fileKey: 'mock/video/derivative-intro.mp4', sizeMB: 96, source: 'mock', status: 'draft', updatedAt: '2026-05-05' },
  { subjectCode: 'nursing', id: 'n-a-001', filename: 'vital-signs-intro.mp4', fileKey: 'mock/video/vital-signs-intro.mp4', sizeMB: 82, source: 'mock', status: 'published', updatedAt: '2026-05-06' },
]

export const reviewItems: ReviewItem[] = [
  { subjectCode: 'math', id: 'r-001', title: '函数极限基础判断', contentType: 'problem', submitter: '助教 A', status: 'pending', updatedAt: '2026-05-05' },
  { subjectCode: 'math', id: 'r-002', title: '函数极限公开讲解', contentType: 'videoLesson', submitter: '老师 B', status: 'approved', updatedAt: '2026-05-05' },
  { subjectCode: 'nursing', id: 'n-r-001', title: '生命体征观察要点', contentType: 'problem', submitter: '医护老师 A', status: 'pending', updatedAt: '2026-05-06' },
]

export const caseMaterials: CaseMaterial[] = [
  {
    subjectCode: 'nursing',
    id: 'n-case-001',
    title: '发热患者基础护理观察案例',
    background: '患者入院后体温持续升高，并伴有脉搏增快与乏力表现。',
    keywords: ['发热', '脉搏增快', '病情观察'],
    relatedKnowledgeTags: ['生命体征', '病情观察'],
    analysisFocus: ['先看体温与脉搏变化趋势', '结合伴随症状判断风险', '记录护理观察重点'],
    status: 'published',
    updatedAt: '2026-05-06',
  },
]

export const confusingPoints: ConfusingPoint[] = [
  {
    subjectCode: 'nursing',
    id: 'n-cp-001',
    title: '发热与高热护理重点',
    leftConcept: '发热',
    rightConcept: '高热',
    contrastSummary: '发热侧重持续观察和一般护理，高热更强调降温措施与并发症监测。',
    status: 'published',
    updatedAt: '2026-05-06',
  },
]

export const memoryTips: MemoryTip[] = [
  {
    subjectCode: 'nursing',
    id: 'n-mt-001',
    title: '生命体征四看口诀',
    tip: '先看数值，再看趋势，结合症状，记录变化。',
    relatedKnowledgeTags: ['生命体征', '病情观察'],
    status: 'published',
    updatedAt: '2026-05-06',
  },
]

export async function queryKnowledgePoints() { return { data: currentSubjectFilter(knowledgePoints), success: true } }
export async function queryProblems() { return { data: currentSubjectFilter(problems), success: true } }
export async function queryDailyProblems() { return { data: currentSubjectFilter(dailyProblems), success: true } }
export async function queryVideoLessons() { return { data: currentSubjectFilter(videoLessons), success: true } }
export async function queryVideoAssets() { return { data: currentSubjectFilter(videoAssets), success: true } }
export async function queryReviewItems() { return { data: currentSubjectFilter(reviewItems), success: true } }
export async function queryCaseMaterials() { return { data: currentSubjectFilter(caseMaterials), success: true } }
export async function queryConfusingPoints() { return { data: currentSubjectFilter(confusingPoints), success: true } }
export async function queryMemoryTips() { return { data: currentSubjectFilter(memoryTips), success: true } }
