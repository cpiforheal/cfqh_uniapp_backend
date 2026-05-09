import type {
  PracticeHomeOverview,
  QuestionBankOverview,
  QuestionDetail,
  ProfileOverview,
  PracticeQuestionSummary,
} from '@/types/study'

const commonDisclaimer = '本工具用于专转本医护大类知识点复习与个人学习辅助，不提供医疗诊断、治疗建议或考试结果承诺。'

const dailyQuestion: PracticeQuestionSummary = {
  id: 'q-001',
  title: '生命体征观察要点，错误的是',
  stem: '生命体征观察要点，错误的是',
  type: 'single_choice',
  difficulty: 'medium',
  difficultyText: '中等',
  knowledgePoints: [{ id: 'kp-001', name: '生命体征观察要点' }],
  estimatedMinutes: 5,
  chapter: '人体解剖学',
}

const continueQuestion: PracticeQuestionSummary = {
  id: 'q-002',
  title: '无菌操作原则判断',
  stem: '以下哪项做法符合无菌操作原则？',
  type: 'single_choice',
  difficulty: 'medium',
  difficultyText: '中等',
  knowledgePoints: [{ id: 'kp-002', name: '无菌操作' }],
  estimatedMinutes: 4,
  chapter: '生理学',
}

export const practiceHomeMock: PracticeHomeOverview = {
  subjectCode: 'nursing',
  subjectName: '医护大类',
  authorization: {
    status: 'authorized',
    expiresText: '有效期至 2026-12-31',
    resourceScopeText: '医护题库、解析、案例材料、公开讲解',
  },
  progress: { done: 12, total: 20, percent: 60 },
  todayProblem: dailyQuestion,
  dailyQuestion,
  continueQuestion,
  recommendedQuestions: [dailyQuestion],
  weeklyCompletedCount: 4,
  recentMistakes: [
    {
      id: 'q-003',
      title: '无菌技术',
      stem: '基础护理学 · 无菌技术',
      type: 'single_choice',
      difficulty: 'medium',
      difficultyText: '中等',
      knowledgePoints: [{ id: 'kp-003', name: '无菌技术' }],
      estimatedMinutes: 3,
      isMistake: true,
      wrongCount: 1,
      chapter: '基础护理操作',
    },
    {
      id: 'q-004',
      title: '肺炎',
      stem: '内科护理学 · 肺炎',
      type: 'single_choice',
      difficulty: 'medium',
      difficultyText: '中等',
      knowledgePoints: [{ id: 'kp-004', name: '肺炎护理' }],
      estimatedMinutes: 3,
      isMistake: true,
      wrongCount: 1,
      chapter: '内科护理学',
    },
  ],
  recommendedVideos: [
    {
      id: 'v-001',
      title: '生命体征观察要点与临床意义',
      duration: 12,
      difficulty: 'basic',
      difficultyText: '基础',
      knowledgePoints: [{ id: 'kp-001', name: '生命体征观察' }],
    },
  ],
  knowledgeCards: [
    {
      id: 'card-001',
      title: '案例材料',
      summary: '结合典型病案，理解生命体征观察要点',
      keywords: ['发热', '脉搏', '病情观察'],
      memoryTip: '先看数值，再看趋势，最后结合症状判断。',
    },
    {
      id: 'card-002',
      title: '记忆提示',
      summary: '识记呼吸观察要点：安静、放松、坐位',
      keywords: ['呼吸', '观察'],
      memoryTip: '安静、放松、坐位。',
    },
  ],
  confusingPoints: [
    {
      id: 'cp-001',
      title: '易混点',
      contrast: '呼吸频率变化的影响因素混淆。',
    },
  ],
  suggestion: '今天建议先完成每日练习，再复习生命体征知识点卡片，并回看 1 个公开讲解。',
  disclaimer: commonDisclaimer,
}

export const questionBankMock: QuestionBankOverview = {
  chapterOptions: [
    { label: '人体解剖学', value: 'anatomy' },
    { label: '生理学', value: 'physiology' },
    { label: '临床医学概论', value: 'clinical_medicine' },
    { label: '临床技能操作', value: 'clinical_skills' },
  ],
  knowledgePointOptions: [
    { label: '生命体征观察', value: '生命体征观察' },
    { label: '无菌操作原则', value: '无菌操作原则' },
    { label: '给药护理要点', value: '给药护理要点' },
  ],
  difficultyOptions: [
    { label: '基础', value: 'basic' },
    { label: '中等', value: 'medium' },
    { label: '提高', value: 'advanced' },
  ],
  typeOptions: [
    { label: '单选题', value: 'single_choice' },
    { label: '判断题', value: 'judgment' },
    { label: '案例分析题', value: 'case_analysis' },
  ],
  catalog: [
    { moduleCode: 'anatomy', moduleName: '人体解剖学', chapter: '人体解剖学', chapterSort: 1, subChapterCount: 1, mockChapters: ['运动系统'], totalQuestions: 1268, totalVideos: 12, completedQuestions: 238, completionRate: 18, difficultyLabel: '中等', locked: false, iconText: '解' },
    { moduleCode: 'physiology', moduleName: '生理学', chapter: '生理学', chapterSort: 2, subChapterCount: 1, mockChapters: ['细胞基本功能'], totalQuestions: 986, totalVideos: 10, completedQuestions: 102, completionRate: 10, difficultyLabel: '中等', locked: false, iconText: '生' },
    { moduleCode: 'clinical_medicine', moduleName: '临床医学概论', chapter: '临床医学概论', chapterSort: 3, subChapterCount: 1, mockChapters: ['常见症状'], totalQuestions: 1123, totalVideos: 9, completedQuestions: 65, completionRate: 6, difficultyLabel: '较难', locked: false, iconText: '临' },
    { moduleCode: 'clinical_skills', moduleName: '临床技能操作', chapter: '临床技能操作', chapterSort: 4, subChapterCount: 1, mockChapters: ['无菌操作'], totalQuestions: 862, totalVideos: 8, completedQuestions: 0, completionRate: 0, difficultyLabel: '较难', locked: false, iconText: '技' },
  ],
  questions: [dailyQuestion, continueQuestion],
}

export const questionDetailMock: Record<string, QuestionDetail> = {
  'q-001': {
    id: 'q-001',
    title: '生命体征观察要点，错误的是',
    stem: '生命体征观察要点，错误的是',
    type: 'single_choice',
    difficulty: 'medium',
    difficultyText: '中等',
    knowledgePoints: [{ id: 'kp-001', name: '生命体征观察要点' }],
    options: [
      { key: 'A', content: '体温观察应注意测量部位与时间' },
      { key: 'B', content: '脉搏观察应注意节律与强弱' },
      { key: 'C', content: '呼吸观察应在活动后立即进行' },
      { key: 'D', content: '血压测量前应嘱患者休息 5 分钟' },
    ],
    answer: 'C',
    analysis: '呼吸观察应在安静状态下进行，活动后会引起呼吸频率加快，影响判断结果。',
    progress: { current: 12, total: 20 },
    nextQuestionId: 'q-002',
    caseMaterial: {
      id: 'case-001',
      title: '案例材料',
      background: '结合典型病案，理解生命体征观察要点。',
      keywords: ['发热', '脉搏增快', '病情观察'],
      analysisFocus: ['先看趋势', '结合伴随症状', '记录护理重点'],
    },
    confusingPoint: {
      id: 'cp-001',
      title: '易混点解析',
      leftConcept: '安静状态观察',
      rightConcept: '活动后观察',
      contrastSummary: '易与呼吸频率变化的影响因素混淆。',
    },
    memoryTip: {
      id: 'mt-001',
      title: '记忆提示',
      tip: '记呼吸观察要点：安静、放松、坐位。',
    },
    relatedVideo: {
      id: 'v-001',
      title: '生命体征观察要点与临床意义',
      duration: 12,
    },
    isFavorite: false,
    inMistakeBook: false,
    wrongCount: 0,
  },
}

export const profileMock: ProfileOverview = {
  nickname: '医护同学',
  avatarText: '护',
  authorization: practiceHomeMock.authorization,
  practiceCount: 28,
  mistakeCount: 6,
  favoriteCount: 4,
  cacheSizeText: '2.3 MB',
}
