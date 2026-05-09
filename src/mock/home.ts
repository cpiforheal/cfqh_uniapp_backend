import type { HomeOverview } from '@/types/study'

export const homeOverviewMock: HomeOverview = {
  subjectCode: 'nursing',
  subjectName: '医护大类',
  weeklyCompletedCount: 3,
  suggestion: '今天建议完成 1 道生命体征练习，并回顾相关知识点。',
  todayProblem: {
    id: 'problem-001',
    title: '今日练习：生命体征观察要点',
    stem: '患者出现体温升高、脉搏增快时，应优先结合哪些观察要点判断病情变化？',
    type: 'single_choice',
    difficulty: 'basic',
    difficultyText: '基础',
    estimatedMinutes: 6,
    knowledgePoints: [
      { id: 'kp-vital', name: '生命体征' },
      { id: 'kp-observe', name: '病情观察' },
    ],
  },
}
