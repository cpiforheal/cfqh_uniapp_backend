import type { HomeOverview } from '@/types/study'

export const nursingHomeOverviewMock: HomeOverview = {
  subjectCode: 'nursing',
  subjectName: '医护大类',
  completedToday: false,
  weeklyCompletedCount: 0,
  suggestion: '今天建议先复习“生命体征观察”核心概念，再完成 1 组案例判断题，重点关注易混点。',
  todayProblem: {
    id: 'nursing-problem-001',
    title: '今日练习：生命体征观察要点',
    stem: '患者出现体温升高、脉搏增快时，应优先结合哪些观察要点判断病情变化？',
    type: 'single_choice',
    difficulty: 'basic',
    difficultyText: '基础',
    estimatedMinutes: 6,
    knowledgePoints: [
      { id: 'nursing-kp-vital-signs', name: '生命体征' },
      { id: 'nursing-kp-observation', name: '病情观察' },
    ],
  },
  knowledgeCards: [
    {
      id: 'nursing-card-001',
      title: '生命体征观察',
      summary: '重点掌握体温、脉搏、呼吸、血压的观察指标和异常提示。',
      keywords: ['体温', '脉搏', '呼吸', '血压'],
      memoryTip: '先看数值，再看趋势，最后结合症状判断。',
    },
    {
      id: 'nursing-card-002',
      title: '无菌操作原则',
      summary: '理解无菌区、污染区和操作前后关键注意事项。',
      keywords: ['无菌区', '污染区', '手卫生'],
      memoryTip: '无菌物品不跨区，操作过程少暴露。',
    },
  ],
  confusingPoints: [
    {
      id: 'confusing-001',
      title: '发热与高热护理重点',
      contrast: '发热强调持续观察和补液，高热更强调降温措施与并发症观察。',
    },
  ],
  disclaimer: '本工具用于专转本医护大类知识点复习与个人学习辅助，不提供医疗诊断、治疗建议或考试结果承诺。',
}
