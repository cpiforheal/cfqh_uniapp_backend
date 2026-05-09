import * as XLSX from 'xlsx'
import type { ContentBlock, Difficulty, ProblemDraft, ProblemDraftIssue, ProblemType, SubjectCode } from '@/types/content'
import { getCurrentSubjectCode } from '@/services/subjects'

const STORAGE_KEY = 'cfqh_admin_problem_drafts_v1'

interface ParsedSection {
  title: string
  content: string
}

interface ParsedProblemInput {
  title: string
  stem: string
  type: ProblemType
  difficulty: Difficulty
  knowledgeTags: string[]
  answer: string
  solution: string
  commonMistake: string
  source: string
  rawText: string
}

export interface ImportSummary {
  total: number
  ready: number
  needsReview: number
  formulaCount: number
  averageScore: number
}

function getTodayText() {
  return new Date().toISOString().slice(0, 10)
}

function safeParseDrafts(value: string | null): ProblemDraft[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readAllDrafts(): ProblemDraft[] {
  if (typeof window === 'undefined') return []
  return safeParseDrafts(window.localStorage.getItem(STORAGE_KEY))
}

function readDrafts(): ProblemDraft[] {
  const subjectCode = getCurrentSubjectCode()
  return readAllDrafts().filter((draft) => (draft.subjectCode ?? 'math') === subjectCode)
}

function writeDrafts(drafts: ProblemDraft[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
}

function normalizeLatex(content: string) {
  return content
    .replace(/^\$\$/, '')
    .replace(/\$\$$/, '')
    .replace(/^\\\(/, '')
    .replace(/\\\)$/, '')
    .replace(/^\\\[/, '')
    .replace(/\\\]$/, '')
    .trim()
}

function toFormulaBlock(content: string): ContentBlock {
  return {
    type: 'formula_text',
    content,
    latex: normalizeLatex(content),
    renderMode: content.startsWith('$$') || content.startsWith('\\[') ? 'block' : 'inline',
  }
}

function splitInlineFormula(line: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const regex = /(\$\$[\s\S]+?\$\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(line)) !== null) {
    const text = line.slice(lastIndex, match.index).trim()
    if (text) blocks.push({ type: 'paragraph', content: text })
    blocks.push(toFormulaBlock(match[0]))
    lastIndex = match.index + match[0].length
  }

  const rest = line.slice(lastIndex).trim()
  if (rest) {
    blocks.push(rest.includes('\\') ? toFormulaBlock(rest) : { type: 'paragraph', content: rest })
  }

  return blocks
}

function toContentBlocks(value: string): ContentBlock[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap(splitInlineFormula)
}

function countFormulaBlocks(blocks: ContentBlock[]) {
  return blocks.filter((block) => block.type === 'formula_text').length
}

function splitSections(raw: string): ParsedSection[] {
  const lines = raw.split('\n')
  const sections: ParsedSection[] = []
  let currentTitle = '题目'
  let currentContent: string[] = []

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s*(.+)$/)
    if (heading) {
      if (currentContent.join('\n').trim()) {
        sections.push({ title: currentTitle, content: currentContent.join('\n').trim() })
      }
      currentTitle = heading[1].trim()
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }

  if (currentContent.join('\n').trim()) {
    sections.push({ title: currentTitle, content: currentContent.join('\n').trim() })
  }

  return sections
}

function findSection(sections: ParsedSection[], names: string[]) {
  return sections.find((section) => names.some((name) => section.title.includes(name)))?.content.trim() ?? ''
}

function parseProblemType(value: string): ProblemType {
  if (value.includes('多选')) return 'multiple_choice'
  if (value.includes('判断')) return 'judgment'
  if (value.includes('选择') || value.includes('单选')) return 'single_choice'
  if (value.includes('填空')) return 'blank'
  return 'solution'
}

function parseDifficulty(value: string): Difficulty {
  if (value.includes('提高') || value.includes('困难') || value.includes('难')) return 'advanced'
  if (value.includes('中')) return 'medium'
  return 'basic'
}

function parseTags(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildIssues(input: ParsedProblemInput): ProblemDraftIssue[] {
  const issues: ProblemDraftIssue[] = []

  if (!input.title) issues.push({ field: 'title', message: '缺少题目标题' })
  if (!input.stem) issues.push({ field: 'stem', message: '缺少题干' })
  if (!input.answer) issues.push({ field: 'answer', message: '缺少答案' })
  if (!input.solution) issues.push({ field: 'solution', message: '缺少解析' })
  if (input.knowledgeTags.length === 0) issues.push({ field: 'knowledgeTags', message: '缺少知识点标签' })

  return issues
}

function calculateQualityScore(issues: ProblemDraftIssue[], formulaCount: number) {
  const issuePenalty = issues.length * 18
  const formulaBonus = formulaCount > 0 ? 5 : 0
  return Math.max(0, Math.min(100, 100 - issuePenalty + formulaBonus))
}

function toProblemDraft(input: ParsedProblemInput, index: number, subjectCode: SubjectCode): ProblemDraft {
  const issues = buildIssues(input)
  const now = getTodayText()
  const stem = toContentBlocks(input.stem)
  const answer = toContentBlocks(input.answer)
  const solutionContent = toContentBlocks(input.solution)
  const commonMistakes = toContentBlocks(input.commonMistake)
  const formulaCount = countFormulaBlocks(stem) + countFormulaBlocks(answer) + countFormulaBlocks(solutionContent) + countFormulaBlocks(commonMistakes)
  const qualityScore = calculateQualityScore(issues, formulaCount)

  return {
    subjectCode,
    id: `draft-${Date.now()}-${index}`,
    title: input.title || `未命名题目 ${index + 1}`,
    stem,
    type: input.type,
    difficulty: input.difficulty,
    knowledgeTags: input.knowledgeTags,
    answer,
    solutionSteps: [
      {
        title: '解析',
        content: solutionContent,
      },
    ],
    commonMistakes,
    source: input.source || '后台文本导入',
    rawText: input.rawText,
    status: issues.length > 0 ? 'needs_review' : 'ready',
    issues,
    qualityScore,
    formulaCount,
    createdAt: now,
    updatedAt: now,
  }
}

function parseSingleProblem(rawText: string, index: number): ProblemDraft {
  const subjectCode = getCurrentSubjectCode()
  const sections = splitSections(rawText)
  const title = findSection(sections, ['题目', '标题']).split('\n')[0]?.trim() ?? ''
  const stem = findSection(sections, ['题干', '题目']) || rawText.trim()
  const type = parseProblemType(findSection(sections, ['题型']))
  const difficulty = parseDifficulty(findSection(sections, ['难度']))
  const knowledgeTags = parseTags(findSection(sections, ['知识点', '标签']))
  const answer = findSection(sections, ['答案', '正确答案'])
  const solution = findSection(sections, ['解析', '分步解析'])
  const commonMistake = findSection(sections, ['易错点', '常见错误'])
  const source = findSection(sections, ['来源'])

  return toProblemDraft({ title, stem, type, difficulty, knowledgeTags, answer, solution, commonMistake, source, rawText }, index, subjectCode)
}

function rowToString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null) return String(value)
  }
  return ''
}

export function parseMarkdownProblemDrafts(rawText: string): ProblemDraft[] {
  return rawText
    .split(/\n---+\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(parseSingleProblem)
}

export async function parseDocxProblemDrafts(file: File): Promise<ProblemDraft[]> {
  const buffer = await file.arrayBuffer()
  const text = new TextDecoder('utf-8').decode(buffer)
  const fallbackText = text.includes('#') || text.includes('题目')
    ? text
    : `# 题目\n${file.name.replace(/\.docx?$/i, '')}\n\n## 题型\n单选题\n\n## 难度\n基础\n\n## 知识点\n待补充\n\n## 答案\n待补充\n\n## 解析\n请在草稿清洗池补充解析。\n\n## 来源\nDocx 导入：${file.name}`

  return parseMarkdownProblemDrafts(fallbackText).map((draft, index) => ({
    ...draft,
    id: `docx-${Date.now()}-${index}`,
    source: `Docx 导入：${file.name}`,
    rawText: fallbackText,
  }))
}

export async function parseExcelProblemDrafts(file: File): Promise<ProblemDraft[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

  const subjectCode = getCurrentSubjectCode()

  return rows.map((row, index) => {
    const title = rowToString(row, ['题目标题', '标题', 'title'])
    const stem = rowToString(row, ['题干', '题目', 'stem'])
    const type = parseProblemType(rowToString(row, ['题型', 'type']))
    const difficulty = parseDifficulty(rowToString(row, ['难度', 'difficulty']))
    const knowledgeTags = parseTags(rowToString(row, ['知识点', '标签', 'knowledgeTags']))
    const answer = rowToString(row, ['答案', '正确答案', 'answer'])
    const solution = rowToString(row, ['解析', '分步解析', 'solution'])
    const commonMistake = rowToString(row, ['易错点', '常见错误', 'commonMistake'])
    const source = rowToString(row, ['来源', 'source']) || `Excel 导入：${file.name}`
    const rawText = JSON.stringify(row)

    return toProblemDraft({ title, stem, type, difficulty, knowledgeTags, answer, solution, commonMistake, source, rawText }, index, subjectCode)
  })
}

export function createImportSummary(drafts: ProblemDraft[]): ImportSummary {
  const total = drafts.length
  const ready = drafts.filter((draft) => draft.status === 'ready').length
  const needsReview = drafts.filter((draft) => draft.status === 'needs_review').length
  const formulaCount = drafts.reduce((sum, draft) => sum + draft.formulaCount, 0)
  const averageScore = total === 0 ? 0 : Math.round(drafts.reduce((sum, draft) => sum + draft.qualityScore, 0) / total)

  return { total, ready, needsReview, formulaCount, averageScore }
}

export function downloadExcelTemplate() {
  const rows = [
    {
      题目标题: '函数极限基础判断',
      题干: '计算 \\(\\lim_{x\\to 0}\\frac{\\sin x}{x}\\)。',
      题型: '解答题',
      难度: '基础',
      知识点: '函数极限,重要极限',
      答案: '\\(1\\)',
      解析: '根据重要极限 \\(\\lim_{x\\to 0}\\frac{\\sin x}{x}=1\\)。',
      易错点: '忽略 x 趋近于 0 时的极限条件。',
      来源: 'Excel 模板',
    },
  ]
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '题目导入模板')
  XLSX.writeFile(workbook, '题目导入模板.xlsx')
}

export function saveProblemDrafts(drafts: ProblemDraft[]) {
  const subjectCode = getCurrentSubjectCode()
  const otherSubjectDrafts = readAllDrafts().filter((draft) => (draft.subjectCode ?? 'math') !== subjectCode)
  writeDrafts([...drafts, ...otherSubjectDrafts])
}

export function clearProblemDrafts() {
  const subjectCode = getCurrentSubjectCode()
  writeDrafts(readAllDrafts().filter((draft) => (draft.subjectCode ?? 'math') !== subjectCode))
}

export function markProblemDraftReady(id: string) {
  const drafts = readAllDrafts()
  writeDrafts(
    drafts.map((draft) =>
      draft.id === id
        ? {
            ...draft,
            status: 'ready',
            issues: [],
            qualityScore: Math.max(draft.qualityScore, 90),
            updatedAt: getTodayText(),
          }
        : draft,
    ),
  )
}

export function markProblemDraftImported(id: string) {
  const drafts = readAllDrafts()
  writeDrafts(
    drafts.map((draft) =>
      draft.id === id
        ? {
            ...draft,
            status: 'imported',
            updatedAt: getTodayText(),
          }
        : draft,
    ),
  )
}

export function deleteProblemDraft(id: string) {
  writeDrafts(readAllDrafts().filter((draft) => draft.id !== id))
}

export async function queryProblemDrafts() {
  return {
    data: readDrafts(),
    success: true,
  }
}
