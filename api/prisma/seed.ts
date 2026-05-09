import { ContentStatus, LicenseStatus, PrismaClient, QuestionType, SubjectCode } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.licenseToken.upsert({
    where: { code: 'NURSING-DEMO-001' },
    update: {},
    create: {
      code: 'NURSING-DEMO-001',
      status: LicenseStatus.unused,
      subjectScope: SubjectCode.nursing,
      resourceScope: 'all',
      maxBindCount: 1,
    },
  })

  const kp1 = await prisma.knowledgePoint.upsert({
    where: { id: 'seed-kp-001' },
    update: { name: '生命体征观察', chapter: '护理学基础', sort: 1, status: ContentStatus.published },
    create: { id: 'seed-kp-001', subjectCode: SubjectCode.nursing, name: '生命体征观察', chapter: '护理学基础', sort: 1, status: ContentStatus.published },
  })
  const kp2 = await prisma.knowledgePoint.upsert({
    where: { id: 'seed-kp-002' },
    update: { name: '无菌操作原则', chapter: '护理学基础', sort: 2, status: ContentStatus.published },
    create: { id: 'seed-kp-002', subjectCode: SubjectCode.nursing, name: '无菌操作原则', chapter: '护理学基础', sort: 2, status: ContentStatus.published },
  })
  await prisma.knowledgePoint.upsert({
    where: { id: 'seed-kp-003' },
    update: { name: '给药护理要点', chapter: '药理与护理', sort: 3, status: ContentStatus.draft },
    create: { id: 'seed-kp-003', subjectCode: SubjectCode.nursing, name: '给药护理要点', chapter: '药理与护理', sort: 3, status: ContentStatus.draft },
  })

  const q1 = await prisma.question.upsert({
    where: { id: 'seed-q-001' },
    update: {
      moduleCode: 'anatomy',
      moduleName: '人体解剖学',
      chapter: '运动系统',
      chapterSort: 1,
      title: '骨的基本结构要点',
      stem: '患者出现体温升高、脉搏增快时，应优先结合哪些观察要点判断病情变化？',
      type: QuestionType.single_choice,
      difficulty: 'medium',
      knowledgeTags: '生命体征,病情观察',
      optionsJson: JSON.stringify([
        { key: 'A', content: '体温观察应注意测量部位与时间' },
        { key: 'B', content: '脉搏观察应注意节律与强弱' },
        { key: 'C', content: '呼吸观察应在活动后立即进行' },
        { key: 'D', content: '血压测量前应嘱患者休息 5 分钟' },
      ]),
      answer: 'C',
      analysis: '先看数值，再看趋势，并结合伴随症状判断风险。',
      source: 'seed',
      status: ContentStatus.published,
    },
    create: {
      id: 'seed-q-001',
      subjectCode: SubjectCode.nursing,
      moduleCode: 'anatomy',
      moduleName: '人体解剖学',
      chapter: '运动系统',
      chapterSort: 1,
      title: '骨的基本结构要点',
      stem: '患者出现体温升高、脉搏增快时，应优先结合哪些观察要点判断病情变化？',
      type: QuestionType.single_choice,
      difficulty: 'medium',
      knowledgeTags: '生命体征,病情观察',
      optionsJson: JSON.stringify([
        { key: 'A', content: '体温观察应注意测量部位与时间' },
        { key: 'B', content: '脉搏观察应注意节律与强弱' },
        { key: 'C', content: '呼吸观察应在活动后立即进行' },
        { key: 'D', content: '血压测量前应嘱患者休息 5 分钟' },
      ]),
      answer: 'C',
      analysis: '先看数值，再看趋势，并结合伴随症状判断风险。',
      source: 'seed',
      status: ContentStatus.published,
    },
  })

  await prisma.question.upsert({
    where: { id: 'seed-q-002' },
    update: {
      moduleCode: 'physiology',
      moduleName: '生理学',
      chapter: '细胞基本功能',
      chapterSort: 1,
      title: '动作电位形成条件判断',
      stem: '以下哪项做法符合无菌操作原则？',
      type: QuestionType.single_choice,
      difficulty: 'medium',
      knowledgeTags: '无菌操作',
      optionsJson: JSON.stringify([
        { key: 'A', content: '无菌物品污染后可短时间继续使用' },
        { key: 'B', content: '无菌区与污染区应明确区分' },
        { key: 'C', content: '打开无菌包后无需记录时间' },
        { key: 'D', content: '操作时可跨越无菌区域' },
      ]),
      answer: 'B',
      analysis: '无菌区和污染区必须严格区分，污染后需立即更换。',
      source: 'seed',
      status: ContentStatus.published,
    },
    create: {
      id: 'seed-q-002',
      subjectCode: SubjectCode.nursing,
      moduleCode: 'physiology',
      moduleName: '生理学',
      chapter: '细胞基本功能',
      chapterSort: 1,
      title: '动作电位形成条件判断',
      stem: '以下哪项做法符合无菌操作原则？',
      type: QuestionType.single_choice,
      difficulty: 'medium',
      knowledgeTags: '无菌操作',
      optionsJson: JSON.stringify([
        { key: 'A', content: '无菌物品污染后可短时间继续使用' },
        { key: 'B', content: '无菌区与污染区应明确区分' },
        { key: 'C', content: '打开无菌包后无需记录时间' },
        { key: 'D', content: '操作时可跨越无菌区域' },
      ]),
      answer: 'B',
      analysis: '无菌区和污染区必须严格区分，污染后需立即更换。',
      source: 'seed',
      status: ContentStatus.published,
    },
  })

  await prisma.caseMaterial.upsert({
    where: { id: 'seed-case-001' },
    update: {
      title: '发热患者基础护理观察案例',
      background: '患者入院后体温持续升高，并伴有脉搏增快与乏力表现。',
      keywords: '发热,脉搏增快,病情观察',
      relatedKnowledgeTags: `${kp1.name},病情观察`,
      analysisFocus: '先看体温与脉搏变化趋势;结合伴随症状判断风险;记录护理观察重点',
      status: ContentStatus.published,
    },
    create: {
      id: 'seed-case-001',
      subjectCode: SubjectCode.nursing,
      title: '发热患者基础护理观察案例',
      background: '患者入院后体温持续升高，并伴有脉搏增快与乏力表现。',
      keywords: '发热,脉搏增快,病情观察',
      relatedKnowledgeTags: `${kp1.name},病情观察`,
      analysisFocus: '先看体温与脉搏变化趋势;结合伴随症状判断风险;记录护理观察重点',
      status: ContentStatus.published,
    },
  })

  await prisma.confusingPoint.upsert({
    where: { id: 'seed-cp-001' },
    update: {
      title: '发热与高热护理重点',
      leftConcept: '发热',
      rightConcept: '高热',
      contrastSummary: '发热侧重持续观察和一般护理，高热更强调降温措施与并发症监测。',
      status: ContentStatus.published,
    },
    create: {
      id: 'seed-cp-001',
      subjectCode: SubjectCode.nursing,
      title: '发热与高热护理重点',
      leftConcept: '发热',
      rightConcept: '高热',
      contrastSummary: '发热侧重持续观察和一般护理，高热更强调降温措施与并发症监测。',
      status: ContentStatus.published,
    },
  })

  await prisma.memoryTip.upsert({
    where: { id: 'seed-mt-001' },
    update: {
      title: '生命体征四看口诀',
      tip: '先看数值，再看趋势，结合症状，记录变化。',
      relatedKnowledgeTags: `${kp1.name},病情观察`,
      status: ContentStatus.published,
    },
    create: {
      id: 'seed-mt-001',
      subjectCode: SubjectCode.nursing,
      title: '生命体征四看口诀',
      tip: '先看数值，再看趋势，结合症状，记录变化。',
      relatedKnowledgeTags: `${kp1.name},病情观察`,
      status: ContentStatus.published,
    },
  })

  await prisma.videoLesson.upsert({
    where: { id: 'seed-video-001' },
    update: {
      moduleCode: 'clinical_medicine',
      moduleName: '临床医学概论',
      chapter: '常见症状',
      title: '常见症状学入门公开讲解',
      duration: 10,
      difficulty: 'basic',
      knowledgeTags: '症状学,问诊基础',
      coverUrl: 'https://example.com/covers/clinical-intro.jpg',
      assetKey: 'mock/video/clinical-intro.mp4',
      videoUrl: 'https://example.com/videos/clinical-intro',
      status: ContentStatus.published,
    },
    create: {
      id: 'seed-video-001',
      subjectCode: SubjectCode.nursing,
      moduleCode: 'clinical_medicine',
      moduleName: '临床医学概论',
      chapter: '常见症状',
      title: '常见症状学入门公开讲解',
      duration: 10,
      difficulty: 'basic',
      knowledgeTags: '症状学,问诊基础',
      coverUrl: 'https://example.com/covers/clinical-intro.jpg',
      assetKey: 'mock/video/clinical-intro.mp4',
      videoUrl: 'https://example.com/videos/clinical-intro',
      status: ContentStatus.published,
    },
  })

  await prisma.dailyPractice.upsert({
    where: { id: 'daily-practice-seed' },
    update: {
      date: new Date('2026-05-06'),
      questionId: q1.id,
      questionTitle: q1.title,
      knowledgeTags: q1.knowledgeTags,
      status: ContentStatus.published,
    },
    create: {
      id: 'daily-practice-seed',
      subjectCode: SubjectCode.nursing,
      date: new Date('2026-05-06'),
      questionId: q1.id,
      questionTitle: q1.title,
      knowledgeTags: q1.knowledgeTags,
      status: ContentStatus.published,
    },
  })

  console.log('Seed completed')
}

main().finally(async () => {
  await prisma.$disconnect()
})
