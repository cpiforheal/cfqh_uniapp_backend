export const NURSING_MODULES = [
  { moduleCode: 'anatomy', moduleName: '人体解剖学', sort: 1, iconText: '解', mockChapter: '运动系统' },
  { moduleCode: 'physiology', moduleName: '生理学', sort: 2, iconText: '生', mockChapter: '细胞基本功能' },
  { moduleCode: 'clinical_medicine', moduleName: '临床医学概论', sort: 3, iconText: '临', mockChapter: '常见症状' },
  { moduleCode: 'clinical_skills', moduleName: '临床技能操作', sort: 4, iconText: '技', mockChapter: '无菌操作' },
] as const

export type NursingModuleCode = (typeof NURSING_MODULES)[number]['moduleCode']

export function getNursingModule(input?: string) {
  return NURSING_MODULES.find((item) => item.moduleCode === input || item.moduleName === input) ?? NURSING_MODULES[0]
}
