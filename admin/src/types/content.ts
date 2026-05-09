export type PublishStatus = 'draft' | 'published' | 'offline'
export type Difficulty = 'basic' | 'medium' | 'advanced'
export type ProblemType = 'single_choice' | 'multiple_choice' | 'judgment' | 'blank' | 'solution' | 'short_answer' | 'case_analysis'
export type StudentFollowStatus = 'active' | 'paused' | 'finished'
export type SubjectCode = 'math' | 'nursing'

export type ProblemDraftStatus = 'needs_review' | 'ready' | 'imported'

export interface ContentBlock {
  type: 'paragraph' | 'formula_text' | 'image' | 'table'
  content: string
  latex?: string
  renderMode?: 'inline' | 'block'
  alt?: string
}

export interface SolutionStep {
  title: string
  content: ContentBlock[]
}

export interface ProblemDraftIssue {
  field: string
  message: string
}

export interface ProblemDraft {
  subjectCode: SubjectCode
  id: string
  title: string
  stem: ContentBlock[]
  type: ProblemType
  difficulty: Difficulty
  knowledgeTags: string[]
  answer: ContentBlock[]
  solutionSteps: SolutionStep[]
  commonMistakes: ContentBlock[]
  source: string
  rawText: string
  status: ProblemDraftStatus
  issues: ProblemDraftIssue[]
  qualityScore: number
  formulaCount: number
  createdAt: string
  updatedAt: string
}

export interface KnowledgePoint {
  subjectCode: SubjectCode
  id: string
  name: string
  chapter: string
  sort: number
  status: PublishStatus
  updatedAt: string
}

export interface Problem {
  subjectCode: SubjectCode
  id: string
  title: string
  stem?: string
  type: ProblemType
  difficulty: Difficulty
  moduleCode?: string
  moduleName?: string
  chapter?: string
  chapterSort?: number
  knowledgeTags: string[]
  optionsJson?: string
  answer: string
  analysis?: string
  source: string
  status: PublishStatus
  updatedAt: string
}

export interface DailyProblem {
  subjectCode: SubjectCode
  id: string
  date: string
  problemTitle: string
  knowledgeTags: string[]
  status: PublishStatus
  updatedAt: string
}

export interface VideoLesson {
  subjectCode: SubjectCode
  id: string
  title: string
  duration: number
  difficulty: Difficulty
  moduleCode?: string
  moduleName?: string
  chapter?: string
  knowledgeTags: string[]
  coverUrl?: string
  assetKey?: string
  videoUrl?: string
  status: PublishStatus
  updatedAt: string
}

export interface StudentRecord {
  id: string
  name: string
  phone: string
  school: string
  major: string
  targetSchool: string
  examYear: string
  weakPoints: string[]
  followStatus: StudentFollowStatus
  note: string
  updatedAt: string
}

export interface VideoAsset {
  subjectCode: SubjectCode
  id: string
  filename: string
  fileKey: string
  sizeMB: number
  source: 'mock' | 'local' | 'cos' | 'vod' | 'oss'
  downloadUrl?: string
  status: PublishStatus
  updatedAt: string
}

export interface AdminAnalyticsOverview {
  totalStudents: number
  authorizedStudents: number
  activeStudents7d: number
  totalPracticeRecords: number
  overallCorrectRate: number
  practiceDays: number
  totalMistakes: number
}

export interface AdminAnalyticsModuleStat {
  moduleCode: string
  moduleName: string
  total: number
  correct: number
  correctRate: number
}

export interface AdminAnalyticsQuestionStat {
  questionId: string
  title: string
  total: number
  correct: number
  wrong: number
  correctRate: number
}

export interface AdminAnalyticsStudentRow {
  userId: string
  openId: string
  nickname: string
  practiceCount: number
  correctRate: number
  mistakeCount: number
  practiceDays: number
  recentPracticeDays: number
  activatedAt?: string | null
  expiresAt?: string | null
  licenseCode?: string | null
  licenseIssuedAt?: string | null
  licenseBoundAt?: string | null
  licenseExpiresAt?: string | null
  licenseStatus?: 'unused' | 'bound' | 'disabled' | 'expired' | null
}

export interface AdminLicenseTokenRow {
  id: string
  code: string
  status: 'unused' | 'bound' | 'disabled' | 'expired'
  subjectScope: SubjectCode
  resourceScope: string
  maxBindCount: number
  boundUserId?: string | null
  boundOpenId?: string | null
  boundAt?: string | null
  expiresAt?: string | null
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    openId: string
    nickname?: string | null
    avatarUrl?: string | null
  } | null
}

export interface AdminAnalytics {
  overview: AdminAnalyticsOverview
  moduleStats: AdminAnalyticsModuleStat[]
  questionStats: AdminAnalyticsQuestionStat[]
  students: AdminAnalyticsStudentRow[]
}

export interface AdminVisibilityModule {
  moduleCode: string
  moduleName: string
  publishedQuestions: number
  draftQuestions: number
  offlineQuestions: number
  publishedVideos: number
  draftVideos: number
  offlineVideos: number
  latestQuestionAt?: string | null
  latestVideoAt?: string | null
}

export interface AdminVisibility {
  modules: AdminVisibilityModule[]
  assets: {
    total: number
    published: number
    draft: number
    offline: number
  }
}

export interface ReviewItem {
  subjectCode: SubjectCode
  id: string
  title: string
  contentType: 'problem' | 'videoLesson' | 'dailyProblem' | 'caseMaterial' | 'confusingPoint' | 'memoryTip'
  submitter: string
  status: 'pending' | 'approved' | 'rejected'
  updatedAt: string
}

export interface CaseMaterial {
  subjectCode: SubjectCode
  id: string
  title: string
  background: string
  keywords: string[]
  relatedKnowledgeTags: string[]
  analysisFocus: string[]
  status: PublishStatus
  updatedAt: string
}

export interface ConfusingPoint {
  subjectCode: SubjectCode
  id: string
  title: string
  leftConcept: string
  rightConcept: string
  contrastSummary: string
  status: PublishStatus
  updatedAt: string
}

export interface MemoryTip {
  subjectCode: SubjectCode
  id: string
  title: string
  tip: string
  relatedKnowledgeTags: string[]
  status: PublishStatus
  updatedAt: string
}
