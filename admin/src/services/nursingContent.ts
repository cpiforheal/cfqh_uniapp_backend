import type {
  CaseMaterial,
  ConfusingPoint,
  KnowledgePoint,
  MemoryTip,
  Problem,
  PublishStatus,
} from '@/types/content'

type EntityKind = 'knowledgePoints' | 'problems' | 'caseMaterials' | 'confusingPoints' | 'memoryTips'

type NursingEntityMap = {
  knowledgePoints: KnowledgePoint
  problems: Problem
  caseMaterials: CaseMaterial
  confusingPoints: ConfusingPoint
  memoryTips: MemoryTip
}

const STORAGE_KEY = 'cfqh_admin_nursing_content_v1'

interface NursingContentStore {
  knowledgePoints: KnowledgePoint[]
  problems: Problem[]
  caseMaterials: CaseMaterial[]
  confusingPoints: ConfusingPoint[]
  memoryTips: MemoryTip[]
}

const defaultStore: NursingContentStore = {
  knowledgePoints: [
    { subjectCode: 'nursing', id: 'n-kp-001', name: '生命体征观察', chapter: '护理学基础', sort: 1, status: 'published', updatedAt: '2026-05-06' },
    { subjectCode: 'nursing', id: 'n-kp-002', name: '无菌操作原则', chapter: '护理学基础', sort: 2, status: 'published', updatedAt: '2026-05-06' },
    { subjectCode: 'nursing', id: 'n-kp-003', name: '给药护理要点', chapter: '药理与护理', sort: 3, status: 'draft', updatedAt: '2026-05-06' },
  ],
  problems: [
    { subjectCode: 'nursing', id: 'n-p-001', title: '生命体征观察要点', type: 'single_choice', difficulty: 'basic', knowledgeTags: ['生命体征', '病情观察'], answer: '观察体温、脉搏、呼吸、血压及变化趋势', source: '医护知识点整理', status: 'published', updatedAt: '2026-05-06' },
    { subjectCode: 'nursing', id: 'n-p-002', title: '无菌操作原则判断', type: 'single_choice', difficulty: 'medium', knowledgeTags: ['无菌操作'], answer: '无菌物品污染后不得继续使用', source: '医护题库导入', status: 'draft', updatedAt: '2026-05-06' },
  ],
  caseMaterials: [
    { subjectCode: 'nursing', id: 'n-case-001', title: '发热患者基础护理观察案例', background: '患者入院后体温持续升高，并伴有脉搏增快与乏力表现。', keywords: ['发热', '脉搏增快', '病情观察'], relatedKnowledgeTags: ['生命体征', '病情观察'], analysisFocus: ['先看体温与脉搏变化趋势', '结合伴随症状判断风险', '记录护理观察重点'], status: 'published', updatedAt: '2026-05-06' },
    { subjectCode: 'nursing', id: 'n-case-002', title: '无菌换药操作案例', background: '患者术后换药过程中，护理人员需判断无菌区与污染区操作边界。', keywords: ['换药', '无菌区', '污染区'], relatedKnowledgeTags: ['无菌操作'], analysisFocus: ['确认无菌物品摆放范围', '识别可能污染步骤', '说明操作判断依据'], status: 'draft', updatedAt: '2026-05-06' },
  ],
  confusingPoints: [
    { subjectCode: 'nursing', id: 'n-cp-001', title: '发热与高热护理重点', leftConcept: '发热', rightConcept: '高热', contrastSummary: '发热侧重持续观察和一般护理，高热更强调降温措施与并发症监测。', status: 'published', updatedAt: '2026-05-06' },
    { subjectCode: 'nursing', id: 'n-cp-002', title: '清洁区与无菌区区别', leftConcept: '清洁区', rightConcept: '无菌区', contrastSummary: '清洁区仅表示较少污染，无菌区则要求严格隔离污染来源。', status: 'draft', updatedAt: '2026-05-06' },
  ],
  memoryTips: [
    { subjectCode: 'nursing', id: 'n-mt-001', title: '生命体征四看口诀', tip: '先看数值，再看趋势，结合症状，记录变化。', relatedKnowledgeTags: ['生命体征', '病情观察'], status: 'published', updatedAt: '2026-05-06' },
    { subjectCode: 'nursing', id: 'n-mt-002', title: '无菌操作记忆提示', tip: '无菌物品不跨区，接触污染即更换。', relatedKnowledgeTags: ['无菌操作'], status: 'draft', updatedAt: '2026-05-06' },
  ],
}

function getTodayText() {
  return new Date().toISOString().slice(0, 10)
}

function safeParseStore(value: string | null): NursingContentStore {
  if (!value) return defaultStore

  try {
    const parsed = JSON.parse(value)
    return {
      knowledgePoints: Array.isArray(parsed.knowledgePoints) ? parsed.knowledgePoints : defaultStore.knowledgePoints,
      problems: Array.isArray(parsed.problems) ? parsed.problems : defaultStore.problems,
      caseMaterials: Array.isArray(parsed.caseMaterials) ? parsed.caseMaterials : defaultStore.caseMaterials,
      confusingPoints: Array.isArray(parsed.confusingPoints) ? parsed.confusingPoints : defaultStore.confusingPoints,
      memoryTips: Array.isArray(parsed.memoryTips) ? parsed.memoryTips : defaultStore.memoryTips,
    }
  } catch {
    return defaultStore
  }
}

export function getNursingContentStore(): NursingContentStore {
  if (typeof window === 'undefined') return defaultStore
  return safeParseStore(window.localStorage.getItem(STORAGE_KEY))
}

function saveNursingContentStore(store: NursingContentStore) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function getNursingList<K extends EntityKind>(kind: K): NursingEntityMap[K][] {
  const store = getNursingContentStore()
  return store[kind] as NursingEntityMap[K][]
}

export function saveNursingEntity<K extends EntityKind>(kind: K, entity: Omit<NursingEntityMap[K], 'id' | 'subjectCode' | 'updatedAt'>, id?: string) {
  const store = getNursingContentStore()
  const now = getTodayText()
  const nextEntity = {
    ...entity,
    id: id ?? `${kind}-${Date.now()}`,
    subjectCode: 'nursing',
    updatedAt: now,
  } as NursingEntityMap[K]

  const currentList = store[kind] as NursingEntityMap[K][]
  const nextList = id
    ? currentList.map((item) => (item.id === id ? nextEntity : item))
    : [nextEntity, ...currentList]

  saveNursingContentStore({
    ...store,
    [kind]: nextList,
  } as NursingContentStore)

  return nextEntity
}

export function deleteNursingEntity<K extends EntityKind>(kind: K, id: string) {
  const store = getNursingContentStore()
  const currentList = store[kind] as NursingEntityMap[K][]
  saveNursingContentStore({
    ...store,
    [kind]: currentList.filter((item) => item.id !== id),
  } as NursingContentStore)
}

export function updateNursingEntityStatus<K extends EntityKind>(kind: K, id: string, status: PublishStatus) {
  const store = getNursingContentStore()
  const currentList = store[kind] as NursingEntityMap[K][]
  saveNursingContentStore({
    ...store,
    [kind]: currentList.map((item) => (item.id === id ? { ...item, status, updatedAt: getTodayText() } : item)),
  } as NursingContentStore)
}
