import * as mammoth from 'mammoth'

type ImportQuestionType = 'single_choice' | 'multiple_choice' | 'judgment' | 'short_answer' | 'case_analysis'

export interface QuestionImportIssue {
  level: 'warning' | 'error'
  message: string
}

export interface ParsedQuestionImportItem {
  id: string
  title: string
  stem: string
  type: ImportQuestionType
  difficulty: string
  moduleCode: string
  moduleName: string
  chapter: string
  chapterSort: number
  knowledgeTags: string[]
  optionsJson: string
  answer: string
  analysis: string
  source: string
  status: 'draft'
  sequenceNo: number
  issues: QuestionImportIssue[]
}

interface QuestionDraft {
  stem: string
  type: ImportQuestionType
  moduleCode: string
  moduleName: string
  chapter: string
  chapterSort: number
  sequenceNo: number
  typeSequenceNo: number
  options: Array<{ key: string; content: string }>
}

interface AnswerItem {
  answer: string
  analysis: string
}

const moduleAliases = [
  { moduleCode: 'anatomy', moduleName: '人体解剖学', patterns: [/课程A/, /解剖学/, /人体解剖学/] },
  { moduleCode: 'physiology', moduleName: '生理学', patterns: [/课程B/, /生理学/] },
  { moduleCode: 'clinical_medicine', moduleName: '临床医学概论', patterns: [/课程C/, /临床医学概论/] },
  { moduleCode: 'clinical_skills', moduleName: '临床技能操作', patterns: [/技能[一二三四五六七八九十]/, /临床技能操作/] },
]

function normalizeLine(line: string) {
  return line.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim()
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map(normalizeLine)
    .filter(Boolean)
}

async function extractDocxText(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer })
  return result.value || ''
}

function resolveModule(line: string) {
  return moduleAliases.find((module) => module.patterns.some((pattern) => pattern.test(line))) ?? null
}

function isModuleHeading(line: string) {
  return /^(课程[A-ZＡ-Ｚ]|技能[一二三四五六七八九十]+)[:：]/.test(line)
}

function parseChapterSort(line: string, fallback: number) {
  const numberMatch = line.match(/第([0-9一二三四五六七八九十百]+)[章节]/)
  if (!numberMatch) return fallback
  const raw = numberMatch[1]
  const numeric = Number(raw)
  if (Number.isFinite(numeric) && numeric > 0) return numeric
  const digits: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 百: 100 }
  if (raw === '十') return 10
  if (raw.includes('十')) {
    const [left, right] = raw.split('十')
    return (left ? digits[left] || 0 : 1) * 10 + (right ? digits[right] || 0 : 0)
  }
  return raw.split('').reduce((sum, char) => sum + (digits[char] || 0), 0) || fallback
}

function parseQuestionType(line: string): ImportQuestionType | null {
  const heading = line.replace(/^[一二三四五六七八九十]+[、\.．]\s*/, '').trim()
  if (/^多选题$/.test(heading)) return 'multiple_choice'
  if (/^(单选题|选择题)$/.test(heading)) return 'single_choice'
  if (/^判断题$/.test(heading)) return 'judgment'
  if (/^案例分析题$/.test(heading)) return 'case_analysis'
  if (/^(简答题|问答题|填空题)$/.test(heading)) return 'short_answer'
  return null
}

function normalizeChapterForMatch(chapter: string) {
  return chapter
    .replace(/^\s*第[0-9一二三四五六七八九十百]+[章节]\s*/, '')
    .replace(/纵膈/g, '纵隔')
    .replace(/[：:，,。.\s]/g, '')
    .trim()
}

function buildAnswerKey(moduleCode: string, chapter: string, sequenceNo: number) {
  return `${moduleCode}|${normalizeChapterForMatch(chapter)}|${sequenceNo}`
}

function buildTypedAnswerKey(moduleCode: string, chapter: string, type: ImportQuestionType, sequenceNo: number) {
  return `${moduleCode}|${normalizeChapterForMatch(chapter)}|${type}|${sequenceNo}`
}

function isChapterLine(line: string) {
  return /^第[0-9一二三四五六七八九十百]+[章节]\s+/.test(line)
}

function stripCatalogPageNumber(line: string) {
  if (/^(课程|技能|第[0-9一二三四五六七八九十百]+[章节])/.test(line)) {
    return line.replace(/\s+\d+$/, '').trim()
  }
  return line.trim()
}

function splitOptionLine(line: string) {
  const matches = Array.from(line.matchAll(/([A-F])(?:[\.\．、]\s*|(?=[\u4e00-\u9fa5（(]))/g))
  if (matches.length === 0) return []
  return matches
    .map((match, index) => {
      const next = matches[index + 1]
      return {
        key: match[1],
        content: line.slice((match.index || 0) + match[0].length, next?.index ?? line.length).trim(),
      }
    })
    .filter((option) => option.content)
}

function isLikelyOptionLine(line: string) {
  return /^[A-F](?:[\.\．、]|(?=[\u4e00-\u9fa5（(]))/.test(line) || splitOptionLine(line).length >= 2
}

function hashText(value: string) {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index)
  }
  return (hash >>> 0).toString(36)
}

function parseQuestionDoc(text: string) {
  const questions: QuestionDraft[] = []
  let moduleCode = 'anatomy'
  let moduleName = '人体解剖学'
  let chapter = '待补充小章节'
  let chapterSort = 1
  let chapterFallbackSort = 1
  let type: ImportQuestionType = 'single_choice'
  let sequenceNo = 0
  let typeSequenceNo = 0
  let stemLines: string[] = []
  let options: Array<{ key: string; content: string }> = []

  const flush = () => {
    const stem = stemLines.join('\n').trim()
    if (!stem) return
    sequenceNo += 1
    typeSequenceNo += 1
    questions.push({ stem, type, moduleCode, moduleName, chapter, chapterSort, sequenceNo, typeSequenceNo, options })
    stemLines = []
    options = []
  }

  for (const rawLine of normalizeText(text)) {
    const line = stripCatalogPageNumber(rawLine.replace(/^•\s*/, ''))
    const nextModule = resolveModule(line)
    if (nextModule && isModuleHeading(line)) {
      flush()
      moduleCode = nextModule.moduleCode
      moduleName = nextModule.moduleName
      chapter = moduleCode === 'clinical_skills' ? line.replace(/^技能[一二三四五六七八九十]+[:：]\s*/, '').trim() || '临床技能操作' : '待补充小章节'
      chapterSort = moduleCode === 'clinical_skills' ? chapterFallbackSort : 1
      chapterFallbackSort = 1
      sequenceNo = 0
      typeSequenceNo = 0
      type = 'single_choice'
      continue
    }

    if (isChapterLine(line)) {
      flush()
      chapter = line.replace(/\s+/g, ' ')
      chapterSort = parseChapterSort(line, chapterFallbackSort)
      chapterFallbackSort += 1
      sequenceNo = 0
      typeSequenceNo = 0
      type = 'single_choice'
      continue
    }

    const nextType = parseQuestionType(line)
    if (nextType) {
      flush()
      type = nextType
      typeSequenceNo = 0
      continue
    }

    if (/^序\s*言$|^目录$/.test(line)) continue

    if (isLikelyOptionLine(line)) {
      const parsedOptions = splitOptionLine(line)
      if (parsedOptions.length > 0) {
        options.push(...parsedOptions)
      } else if (options.length > 0) {
        options[options.length - 1].content = `${options[options.length - 1].content}${line}`.trim()
      }
      continue
    }

    if (options.length > 0) flush()
    stemLines.push(line)
  }

  flush()
  return questions.filter((question) => question.options.length > 0 || question.type === 'short_answer' || question.type === 'case_analysis')
}

function parseAnswerDoc(text: string) {
  const answers = new Map<string, AnswerItem>()
  let moduleCode = 'anatomy'
  let chapter = '待补充小章节'
  let chapterFallbackSort = 1
  let type: ImportQuestionType = 'single_choice'
  let currentKey = ''

  const setAnswer = (sequenceNo: number, answer: string, analysis: string) => {
    const normalizedAnswer = answer.replace(/[，,\s、]/g, '').trim()
    if (!normalizedAnswer) return
    const value = { answer: normalizedAnswer, analysis: analysis.replace(/^解析[:：]?/, '').trim() || normalizedAnswer }
    currentKey = buildAnswerKey(moduleCode, chapter, sequenceNo)
    answers.set(currentKey, value)
    answers.set(buildTypedAnswerKey(moduleCode, chapter, type, sequenceNo), value)
  }

  for (const rawLine of normalizeText(text)) {
    const line = stripCatalogPageNumber(rawLine)
    const nextModule = resolveModule(line)
    if (nextModule && isModuleHeading(line)) {
      moduleCode = nextModule.moduleCode
      chapter = moduleCode === 'clinical_skills' ? line.replace(/^技能[一二三四五六七八九十]+[:：]\s*/, '').trim() || '临床技能操作' : '待补充小章节'
      chapterFallbackSort = 1
      type = 'single_choice'
      currentKey = ''
      continue
    }

    if (isChapterLine(line)) {
      chapter = line.replace(/\s+/g, ' ')
      chapterFallbackSort += 1
      type = 'single_choice'
      currentKey = ''
      continue
    }

    const nextType = parseQuestionType(line)
    if (nextType) {
      type = nextType
      currentKey = ''
      continue
    }

    const rangeMatch = line.match(/^(\d+)\s*[-－~～]\s*(\d+)[\.．、]?\s*(?:正确答案)?均?为?【([^】]+)】[。\.]?(.*)$/)
    if (rangeMatch) {
      const start = Number(rangeMatch[1])
      const end = Number(rangeMatch[2])
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end) {
        for (let sequenceNo = start; sequenceNo <= end; sequenceNo += 1) {
          setAnswer(sequenceNo, rangeMatch[3], rangeMatch[4])
        }
      }
      continue
    }

    const bracketMatches = Array.from(line.matchAll(/(\d+)[\.．、]?\s*【([^】]+)】[。\.]?/g))
    if (bracketMatches.length > 0 && bracketMatches[0].index === 0) {
      bracketMatches.forEach((match, index) => {
        const next = bracketMatches[index + 1]
        const rest = line.slice((match.index || 0) + match[0].length, next?.index ?? line.length)
        setAnswer(Number(match[1]), match[2], rest)
      })
      continue
    }

    const plainMatch = line.match(/^(\d+)[\.．、]\s*(.+)$/)
    const inferredAnswer = plainMatch?.[2].match(/(?:正确答案|故本题|故该题|该题|本题|因此|故)(?:正确答案)?(?:应|为|选|选择)?[为是：:，,\s]*([A-F]{1,6})(?=[。\.，,\s、]|$)/)
    if (plainMatch && inferredAnswer) {
      setAnswer(Number(plainMatch[1]), inferredAnswer[1], plainMatch[2])
      continue
    }

    const active = currentKey ? answers.get(currentKey) : null
    if (active && !resolveModule(line) && !isChapterLine(line)) {
      active.analysis = `${active.analysis}\n${line}`.trim()
    }
  }

  void chapterFallbackSort
  return answers
}

function buildIssues(question: QuestionDraft, answer?: AnswerItem) {
  const issues: QuestionImportIssue[] = []
  if (!question.stem) issues.push({ level: 'error', message: '缺少题干' })
  if ((question.type === 'single_choice' || question.type === 'multiple_choice') && question.options.length < 2) {
    issues.push({ level: 'error', message: '选择题选项少于 2 个' })
  }
  if (!answer?.answer) issues.push({ level: 'warning', message: '未匹配到答案' })
  if (!answer?.analysis || answer.analysis === answer.answer) issues.push({ level: 'warning', message: '解析为空或仅有答案' })
  return issues
}

export async function previewQuestionImport(questionDoc: Buffer, questionDocName: string, answerDoc?: Buffer) {
  const [questionText, answerText] = await Promise.all([
    extractDocxText(questionDoc),
    answerDoc ? extractDocxText(answerDoc) : Promise.resolve(''),
  ])
  const questions = parseQuestionDoc(questionText)
  const answers = answerText ? parseAnswerDoc(answerText) : new Map<string, AnswerItem>()
  const typeOrdinals = new Map<string, number>()
  const items: ParsedQuestionImportItem[] = questions.map((question) => {
    const typeOrdinalKey = `${question.moduleCode}|${question.chapter}|${question.type}`
    const typeOrdinal = (typeOrdinals.get(typeOrdinalKey) || 0) + 1
    typeOrdinals.set(typeOrdinalKey, typeOrdinal)
    const answer =
      answers.get(buildTypedAnswerKey(question.moduleCode, question.chapter, question.type, question.typeSequenceNo)) ??
      answers.get(buildTypedAnswerKey(question.moduleCode, question.chapter, question.type, typeOrdinal)) ??
      answers.get(buildAnswerKey(question.moduleCode, question.chapter, question.sequenceNo))
    const issues = buildIssues(question, answer)
    const title = question.stem.replace(/\s+/g, ' ').slice(0, 80)
    return {
      id: `qimp-${hashText(`${question.moduleCode}|${question.chapter}|${question.sequenceNo}|${question.stem}`)}`,
      title,
      stem: question.stem,
      type: question.type,
      difficulty: 'basic',
      moduleCode: question.moduleCode,
      moduleName: question.moduleName,
      chapter: question.chapter,
      chapterSort: question.chapterSort,
      knowledgeTags: [question.chapter],
      optionsJson: JSON.stringify(question.options),
      answer: answer?.answer || '',
      analysis: answer?.analysis || '',
      source: `Docx 导入：${questionDocName}`,
      status: 'draft',
      sequenceNo: question.sequenceNo,
      issues,
    }
  })

  const missingAnswers = items.filter((item) => !item.answer).length
  const optionIssueCount = items.filter((item) => item.issues.some((issue) => issue.message.includes('选项'))).length
  const duplicateCount = items.length - new Set(items.map((item) => item.id)).size
  return {
    summary: {
      total: items.length,
      ready: items.filter((item) => item.issues.every((issue) => issue.level !== 'error')).length,
      needsReview: items.filter((item) => item.issues.length > 0).length,
      matchedAnswers: items.length - missingAnswers,
      missingAnswers,
      optionIssueCount,
      duplicateCount,
    },
    items,
  }
}
