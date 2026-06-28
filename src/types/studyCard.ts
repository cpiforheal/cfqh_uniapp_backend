export interface RichTextSegment {
  text: string
  color: string | null
  bold?: boolean
}

export interface StudyCardModule {
  moduleCode: string
  moduleName: string
  sort: number
  questionCount: number
  masteredCount: number
  knowledgeCardCount: number
}

export interface StudyCardHomeData {
  modules: StudyCardModule[]
  streak: number
  totalMastered: number
}

export interface StudyCardQuestionBrief {
  id: string
  moduleCode: string
  seq: number
  type: 'single_choice' | 'judgment'
  knowledgeCardCount: number
  knowledgeCardTitle: string
  locked: boolean
}

export interface StudyCardKnowledgeCard {
  title: string
  body: RichTextSegment[]
}

export interface StudyCardDetail {
  id: string
  moduleCode: string
  moduleName: string
  seq: number
  stem: string
  type: 'single_choice' | 'judgment'
  options: { key: string; text: string }[]
  answer: string
  knowledgeCards: StudyCardKnowledgeCard[]
}
