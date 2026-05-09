export type Difficulty = 'basic' | 'medium' | 'advanced'
export type SubjectCode = 'nursing'
export type AuthorizationStatus = 'authorized' | 'unauthorized' | 'expiring' | 'unknown'
export type PracticeMode = 'daily' | 'random' | 'chapter'
export type QuestionType = 'single_choice' | 'multiple_choice' | 'judgment' | 'short_answer' | 'case_analysis'

export interface KnowledgePointTag {
  id: string
  name: string
}

export interface QuestionOption {
  key: string
  content: string
}

export interface PracticeProgress {
  current?: number
  total: number
  done?: number
  percent: number
}

export interface PracticeQuestionSummary {
  id: string
  title: string
  stem: string
  type: QuestionType
  difficulty: Difficulty
  difficultyText: string
  knowledgePoints: KnowledgePointTag[]
  options?: QuestionOption[]
  estimatedMinutes: number
  completed?: boolean
  isMistake?: boolean
  wrongCount?: number
  chapter?: string
}

export interface ChapterQuestionGroup {
  chapter: string
  questions: PracticeQuestionSummary[]
}

export interface NursingKnowledgeCard {
  id: string
  title: string
  summary: string
  keywords: string[]
  memoryTip: string
}

export interface ConfusingPointSummary {
  id: string
  title: string
  contrast: string
}

export interface VideoLessonSummary {
  id: string
  title: string
  duration: number
  difficulty: Difficulty
  difficultyText: string
  knowledgePoints: KnowledgePointTag[]
  moduleCode?: string
  moduleName?: string
  chapter?: string
  coverUrl?: string
  assetKey?: string
  videoUrl?: string
}

export interface AuthorizationInfo {
  status: AuthorizationStatus
  tokenCode?: string
  expiresText?: string
  resourceScopeText: string
  reason?: string
}

export interface HomeOverview {
  subjectCode: SubjectCode
  subjectName: string
  authorization?: AuthorizationInfo
  progress?: PracticeProgress
  continueQuestion?: PracticeQuestionSummary
  todayProblem: PracticeQuestionSummary
  dailyQuestion?: PracticeQuestionSummary
  recommendedQuestions?: PracticeQuestionSummary[]
  completedToday?: boolean
  weeklyCompletedCount: number
  recentMistakes?: PracticeQuestionSummary[]
  recommendedVideos?: VideoLessonSummary[]
  knowledgeCards?: NursingKnowledgeCard[]
  confusingPoints?: ConfusingPointSummary[]
  suggestion: string
  disclaimer?: string
}

export interface PracticeHomeOverview extends HomeOverview {
  authorization: AuthorizationInfo
  progress: PracticeProgress
  recommendedQuestions: PracticeQuestionSummary[]
  recentMistakes: PracticeQuestionSummary[]
  recommendedVideos: VideoLessonSummary[]
  knowledgeCards: NursingKnowledgeCard[]
  confusingPoints: ConfusingPointSummary[]
  disclaimer: string
}

export interface CaseMaterial {
  id: string
  title: string
  background: string
  keywords: string[]
  analysisFocus: string[]
}

export interface MemoryTip {
  id: string
  title: string
  tip: string
}

export interface ConfusingPoint {
  id: string
  title: string
  leftConcept: string
  rightConcept: string
  contrastSummary: string
}

export interface RelatedVideo {
  id: string
  title: string
  duration: number
  coverUrl?: string
  videoUrl?: string
}

export interface QuestionDetail {
  id: string
  title: string
  stem: string
  type: QuestionType
  difficulty: Difficulty
  difficultyText: string
  knowledgePoints: KnowledgePointTag[]
  options: QuestionOption[]
  answer: string
  analysis: string
  progress: {
    current: number
    total: number
  }
  nextQuestionId?: string | null
  caseMaterial?: CaseMaterial
  confusingPoint?: ConfusingPoint
  memoryTip?: MemoryTip
  relatedVideo?: RelatedVideo
  isFavorite: boolean
  inMistakeBook: boolean
  wrongCount: number
}

export interface QuestionBankFilterOption {
  label: string
  value: string
}

export interface QuestionCatalogItem {
  moduleCode?: string
  moduleName?: string
  chapter: string
  chapterSort: number
  subChapterCount?: number
  mockChapters?: string[]
  totalQuestions: number
  totalVideos?: number
  completedQuestions: number
  completionRate: number
  difficultyLabel: string
  locked: boolean
  iconText: string
}

export interface QuestionBankOverview {
  authorization?: AuthorizationInfo
  chapterOptions: QuestionBankFilterOption[]
  knowledgePointOptions: QuestionBankFilterOption[]
  difficultyOptions: QuestionBankFilterOption[]
  typeOptions: QuestionBankFilterOption[]
  catalog: QuestionCatalogItem[]
  questions: PracticeQuestionSummary[]
}

export interface ProfileOverview {
  nickname: string
  avatarText: string
  avatarUrl?: string
  authorization: AuthorizationInfo
  practiceCount: number
  mistakeCount: number
  favoriteCount: number
  cacheSizeText: string
}
