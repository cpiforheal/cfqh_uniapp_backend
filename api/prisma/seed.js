const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const localDevUsers = [
  {
    openId: 'local-weapp-debug-openid',
    nursingCode: 'NUR-LOCAL-WEAPP',
    studyCardCode: 'SC-LOCAL-WEAPP',
  },
  {
    openId: 'dev-open-id-local',
    nursingCode: 'NUR-LOCAL-API',
    studyCardCode: 'SC-LOCAL-API',
  },
]

async function seedLocalDevAuthorization() {
  const studyCardExpiresAt = new Date('2099-12-31T23:59:59.000Z')

  for (const item of localDevUsers) {
    const user = await prisma.user.upsert({
      where: { openId: item.openId },
      update: {},
      create: {
        openId: item.openId,
        nickname: '本地调试用户',
        loginCount: 0,
        lastLoginAt: new Date(),
        lastClientEnv: 'miniapp',
      },
    })

    const nursingToken = await prisma.licenseToken.upsert({
      where: { code: item.nursingCode },
      update: {
        status: 'bound',
        subjectScope: 'nursing',
        resourceScope: 'all',
        boundUserId: user.id,
        boundOpenId: item.openId,
        boundAt: new Date(),
        expiresAt: null,
      },
      create: {
        code: item.nursingCode,
        status: 'bound',
        subjectScope: 'nursing',
        resourceScope: 'all',
        maxBindCount: 1,
        groupTag: 'local-dev',
        boundUserId: user.id,
        boundOpenId: item.openId,
        boundAt: new Date(),
      },
    })

    await prisma.userAuthorization.upsert({
      where: { userId: user.id },
      update: {
        licenseTokenId: nursingToken.id,
        subjectScope: 'nursing',
        resourceScope: 'all',
        expiresAt: null,
      },
      create: {
        userId: user.id,
        licenseTokenId: nursingToken.id,
        subjectScope: 'nursing',
        resourceScope: 'all',
      },
    })

    const studyCardToken = await prisma.licenseToken.upsert({
      where: { code: item.studyCardCode },
      update: {
        status: 'bound',
        subjectScope: 'study_card',
        resourceScope: 'all',
        boundUserId: user.id,
        boundOpenId: item.openId,
        boundAt: new Date(),
        expiresAt: studyCardExpiresAt,
      },
      create: {
        code: item.studyCardCode,
        status: 'bound',
        subjectScope: 'study_card',
        resourceScope: 'all',
        maxBindCount: 1,
        groupTag: 'local-dev',
        boundUserId: user.id,
        boundOpenId: item.openId,
        boundAt: new Date(),
        expiresAt: studyCardExpiresAt,
      },
    })

    await prisma.studyCardAuthorization.upsert({
      where: { userId: user.id },
      update: {
        openId: item.openId,
        tokenId: studyCardToken.id,
        expiresAt: studyCardExpiresAt,
      },
      create: {
        userId: user.id,
        openId: item.openId,
        tokenId: studyCardToken.id,
        expiresAt: studyCardExpiresAt,
      },
    })
  }
}

async function main() {
  await prisma.licenseToken.upsert({
    where: { code: 'NURSING-DEMO-001' },
    update: {},
    create: {
      code: 'NURSING-DEMO-001',
      status: 'unused',
      subjectScope: 'nursing',
      resourceScope: 'all',
      maxBindCount: 1,
    },
  })

  const kp1 = await prisma.knowledgePoint.upsert({
    where: { id: 'seed-kp-001' },
    update: { name: '生命体征观察', chapter: '护理学基础', sort: 1, status: 'published' },
    create: { id: 'seed-kp-001', subjectCode: 'nursing', name: '生命体征观察', chapter: '护理学基础', sort: 1, status: 'published' },
  })

  await prisma.knowledgePoint.upsert({
    where: { id: 'seed-kp-002' },
    update: { name: '无菌操作原则', chapter: '护理学基础', sort: 2, status: 'published' },
    create: { id: 'seed-kp-002', subjectCode: 'nursing', name: '无菌操作原则', chapter: '护理学基础', sort: 2, status: 'published' },
  })

  await prisma.knowledgePoint.upsert({
    where: { id: 'seed-kp-003' },
    update: { name: '给药护理要点', chapter: '药理与护理', sort: 3, status: 'draft' },
    create: { id: 'seed-kp-003', subjectCode: 'nursing', name: '给药护理要点', chapter: '药理与护理', sort: 3, status: 'draft' },
  })

  const q1 = await prisma.question.upsert({
    where: { id: 'seed-q-001' },
    update: {
      title: '生命体征观察要点',
      stem: '患者出现体温升高、脉搏增快时，应优先结合哪些观察要点判断病情变化？',
      type: 'single_choice',
      difficulty: 'basic',
      knowledgeTags: '生命体征,病情观察',
      answer: '观察体温、脉搏、呼吸、血压及变化趋势',
      analysis: '先看数值，再看趋势，并结合伴随症状判断风险。',
      source: 'seed',
      status: 'published',
    },
    create: {
      id: 'seed-q-001',
      subjectCode: 'nursing',
      title: '生命体征观察要点',
      stem: '患者出现体温升高、脉搏增快时，应优先结合哪些观察要点判断病情变化？',
      type: 'single_choice',
      difficulty: 'basic',
      knowledgeTags: '生命体征,病情观察',
      answer: '观察体温、脉搏、呼吸、血压及变化趋势',
      analysis: '先看数值，再看趋势，并结合伴随症状判断风险。',
      source: 'seed',
      status: 'published',
    },
  })

  await prisma.question.upsert({
    where: { id: 'seed-q-002' },
    update: {
      title: '无菌操作原则判断',
      stem: '以下哪项做法符合无菌操作原则？',
      type: 'single_choice',
      difficulty: 'medium',
      knowledgeTags: '无菌操作',
      answer: '无菌物品污染后不得继续使用',
      analysis: '无菌区和污染区必须严格区分，污染后需立即更换。',
      source: 'seed',
      status: 'published',
    },
    create: {
      id: 'seed-q-002',
      subjectCode: 'nursing',
      title: '无菌操作原则判断',
      stem: '以下哪项做法符合无菌操作原则？',
      type: 'single_choice',
      difficulty: 'medium',
      knowledgeTags: '无菌操作',
      answer: '无菌物品污染后不得继续使用',
      analysis: '无菌区和污染区必须严格区分，污染后需立即更换。',
      source: 'seed',
      status: 'published',
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
      status: 'published',
    },
    create: {
      id: 'seed-case-001',
      subjectCode: 'nursing',
      title: '发热患者基础护理观察案例',
      background: '患者入院后体温持续升高，并伴有脉搏增快与乏力表现。',
      keywords: '发热,脉搏增快,病情观察',
      relatedKnowledgeTags: `${kp1.name},病情观察`,
      analysisFocus: '先看体温与脉搏变化趋势;结合伴随症状判断风险;记录护理观察重点',
      status: 'published',
    },
  })

  await prisma.confusingPoint.upsert({
    where: { id: 'seed-cp-001' },
    update: {
      title: '发热与高热护理重点',
      leftConcept: '发热',
      rightConcept: '高热',
      contrastSummary: '发热侧重持续观察和一般护理，高热更强调降温措施与并发症监测。',
      status: 'published',
    },
    create: {
      id: 'seed-cp-001',
      subjectCode: 'nursing',
      title: '发热与高热护理重点',
      leftConcept: '发热',
      rightConcept: '高热',
      contrastSummary: '发热侧重持续观察和一般护理，高热更强调降温措施与并发症监测。',
      status: 'published',
    },
  })

  await prisma.memoryTip.upsert({
    where: { id: 'seed-mt-001' },
    update: {
      title: '生命体征四看口诀',
      tip: '先看数值，再看趋势，结合症状，记录变化。',
      relatedKnowledgeTags: `${kp1.name},病情观察`,
      status: 'published',
    },
    create: {
      id: 'seed-mt-001',
      subjectCode: 'nursing',
      title: '生命体征四看口诀',
      tip: '先看数值，再看趋势，结合症状，记录变化。',
      relatedKnowledgeTags: `${kp1.name},病情观察`,
      status: 'published',
    },
  })

  await prisma.videoLesson.upsert({
    where: { id: 'seed-video-001' },
    update: {
      title: '生命体征观察公开讲解',
      duration: 10,
      difficulty: 'basic',
      knowledgeTags: kp1.name,
      videoUrl: 'https://example.com/videos/vital-signs',
      status: 'published',
    },
    create: {
      id: 'seed-video-001',
      subjectCode: 'nursing',
      title: '生命体征观察公开讲解',
      duration: 10,
      difficulty: 'basic',
      knowledgeTags: kp1.name,
      videoUrl: 'https://example.com/videos/vital-signs',
      status: 'published',
    },
  })

  await prisma.dailyPractice.upsert({
    where: { id: 'daily-practice-seed' },
    update: {
      date: new Date('2026-05-06'),
      questionId: q1.id,
      questionTitle: q1.title,
      knowledgeTags: q1.knowledgeTags,
      status: 'published',
    },
    create: {
      id: 'daily-practice-seed',
      subjectCode: 'nursing',
      date: new Date('2026-05-06'),
      questionId: q1.id,
      questionTitle: q1.title,
      knowledgeTags: q1.knowledgeTags,
      status: 'published',
    },
  })

  await seedLocalDevAuthorization()

  console.log('Seed completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
