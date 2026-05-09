export type SubjectCode = 'math' | 'nursing'

export interface SubjectOption {
  code: SubjectCode
  name: string
  description: string
}

export const subjectOptions: SubjectOption[] = [
  {
    code: 'nursing',
    name: '医护大类',
    description: '优先完善知识点复习、案例训练和每日练习。',
  },
  {
    code: 'math',
    name: '高数',
    description: '保留现有题库、公式导入和公开讲解能力。',
  },
]

export const defaultSubjectCode: SubjectCode = 'nursing'
