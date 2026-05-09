export const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已下线', value: 'offline' },
]

export const difficultyOptions = [
  { label: '基础', value: 'basic' },
  { label: '中等', value: 'medium' },
  { label: '提高', value: 'advanced' },
]

export const nursingModuleOptions = [
  { label: '人体解剖学', value: 'anatomy' },
  { label: '生理学', value: 'physiology' },
  { label: '临床医学概论', value: 'clinical_medicine' },
  { label: '临床技能操作', value: 'clinical_skills' },
]

export const nursingModuleNameMap: Record<string, string> = {
  anatomy: '人体解剖学',
  physiology: '生理学',
  clinical_medicine: '临床医学概论',
  clinical_skills: '临床技能操作',
}

export const problemTypeOptions = [
  { label: '单选题', value: 'single_choice' },
  { label: '多选题', value: 'multiple_choice' },
  { label: '判断题', value: 'judgment' },
  { label: '填空题', value: 'blank' },
  { label: '解答题', value: 'solution' },
]
