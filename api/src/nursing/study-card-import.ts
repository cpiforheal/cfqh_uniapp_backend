import * as JSZip from 'jszip'
import { DOMParser, Element as XmlElement } from '@xmldom/xmldom'

export interface RichTextSegment {
  text: string
  color: string | null
}

export interface ParsedKnowledgeCard {
  seq: number
  title: string
  body: RichTextSegment[]
}

export interface ParsedStudyCardQuestion {
  seq: number
  stem: string
  type: 'single_choice' | 'judgment'
  options: { key: string; text: string }[]
  answer: string
  knowledgeCards: ParsedKnowledgeCard[]
}

export interface ParsedStudyCardModule {
  moduleCode: string
  moduleName: string
  sort: number
  questions: ParsedStudyCardQuestion[]
}

export interface ParsedStudyCardImport {
  modules: ParsedStudyCardModule[]
  totalQuestions: number
  totalCards: number
}

// ─── XML 解析工具 ─────────────────────────────────────────────────────────────

function getAttr(node: XmlElement, ns: string, local: string): string | null {
  return node.getAttributeNS(ns, local) || node.getAttribute(`w:${local}`) || null
}

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

function parseParagraph(paraNode: XmlElement): RichTextSegment[] {
  const segments: RichTextSegment[] = []
  const runs = paraNode.getElementsByTagNameNS(W_NS, 'r')
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i] as XmlElement
    // 获取颜色
    let color: string | null = null
    const rPrList = run.getElementsByTagNameNS(W_NS, 'rPr')
    if (rPrList.length > 0) {
      const rPr = rPrList[0] as XmlElement
      const colorNodes = rPr.getElementsByTagNameNS(W_NS, 'color')
      if (colorNodes.length > 0) {
        const val = getAttr(colorNodes[0] as XmlElement, W_NS, 'val')
        if (val && val !== 'auto' && val !== '000000') {
          color = `#${val.toUpperCase()}`
        }
      }
    }
    // 获取文本
    const tNodes = run.getElementsByTagNameNS(W_NS, 't')
    let text = ''
    for (let j = 0; j < tNodes.length; j++) {
      text += tNodes[j].textContent || ''
    }
    if (!text) continue
    // 合并相邻同色 segment
    if (segments.length > 0 && segments[segments.length - 1].color === color) {
      segments[segments.length - 1].text += text
    } else {
      segments.push({ text, color })
    }
  }
  return segments
}

function segmentsToPlainText(segs: RichTextSegment[]): string {
  return segs.map((s) => s.text).join('')
}

// ─── 文档解析主逻辑 ───────────────────────────────────────────────────────────

async function extractXmlParagraphs(buffer: Buffer): Promise<{ text: string; node: XmlElement }[]> {
  const zip = await JSZip.loadAsync(buffer)
  const xmlStr = await zip.file('word/document.xml')!.async('string')
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml')
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0] as XmlElement
  const paraNodes = body.getElementsByTagNameNS(W_NS, 'p')
  const result: { text: string; node: XmlElement }[] = []
  for (let i = 0; i < paraNodes.length; i++) {
    const node = paraNodes[i] as XmlElement
    const segs = parseParagraph(node)
    const text = segmentsToPlainText(segs).trim()
    result.push({ text, node })
  }
  return result
}

// 章节标题：一、二、三...
const CHAPTER_RE = /^([一二三四五六七八九十]+)[、．.]\s*(.+)/

// 题目编号：1. 2. 3.
const QUESTION_NUM_RE = /^(\d+)[.．]\s*(.+)/

// 选项行：A. B. C. D.
const OPTION_RE = /^([A-Da-d])[.．．\s]\s*(.+)/

// 正确答案行
const ANSWER_RE = /^正确答案[：:]\s*([A-Da-d])/i

// 知识点卡片标题行
const CARD_TITLE_RE = /^(带背知识点[延伸]*[：:]?|题目点评[：:]?|✅[️]?带背知识点[延伸]*[：:]?|✅[️]?题目点评[：:]?)/

function normalizeCardTitle(raw: string): string {
  return raw
    .replace(/^✅[️]?\s*/, '')
    .replace(/[：:]\s*$/, '')
    .trim()
}

// 中文数字 → 模块 code
const CHAPTER_CODE_MAP: Record<string, string> = {
  一: 'intro',
  二: 'locomotor',
  三: 'chapter3',
  四: 'chapter4',
  五: 'chapter5',
  六: 'chapter6',
  七: 'chapter7',
  八: 'chapter8',
  九: 'chapter9',
  十: 'chapter10',
}

export async function parseStudyCardDoc(buffer: Buffer): Promise<ParsedStudyCardImport> {
  const paragraphs = await extractXmlParagraphs(buffer)

  const modules: ParsedStudyCardModule[] = []
  let currentModule: ParsedStudyCardModule | null = null
  let currentQuestion: ParsedStudyCardQuestion | null = null
  let currentCard: { title: string; lines: { text: string; node: XmlElement }[] } | null = null
  let moduleSort = 0

  function finalizeCard() {
    if (!currentCard || !currentQuestion) return
    const body: RichTextSegment[] = []
    for (let i = 0; i < currentCard.lines.length; i++) {
      const line = currentCard.lines[i]
      const lineSegs = parseParagraph(line.node)
      if (i > 0) body.push({ text: '\n', color: null })
      body.push(...lineSegs)
    }
    currentQuestion.knowledgeCards.push({
      seq: currentQuestion.knowledgeCards.length + 1,
      title: currentCard.title,
      body,
    })
    currentCard = null
  }

  function finalizeQuestion() {
    finalizeCard()
    if (!currentQuestion || !currentModule) return
    currentModule.questions.push(currentQuestion)
    currentQuestion = null
  }

  function finalizeModule() {
    finalizeQuestion()
    if (!currentModule) return
    modules.push(currentModule)
    currentModule = null
  }

  for (const para of paragraphs) {
    const text = para.text
    if (!text) continue

    // 章节标题
    const chapterMatch = text.match(CHAPTER_RE)
    if (chapterMatch) {
      finalizeModule()
      moduleSort++
      const chineseNum = chapterMatch[1]
      const name = chapterMatch[2].trim()
      currentModule = {
        moduleCode: CHAPTER_CODE_MAP[chineseNum] || `chapter_${moduleSort}`,
        moduleName: name,
        sort: moduleSort,
        questions: [],
      }
      continue
    }

    if (!currentModule) continue

    // 题目编号行
    const qMatch = text.match(QUESTION_NUM_RE)
    if (qMatch) {
      finalizeQuestion()
      currentQuestion = {
        seq: parseInt(qMatch[1], 10),
        stem: qMatch[2].trim(),
        type: 'single_choice',
        options: [],
        answer: '',
        knowledgeCards: [],
      }
      continue
    }

    if (!currentQuestion) continue

    // 正确答案
    const answerMatch = text.match(ANSWER_RE)
    if (answerMatch) {
      currentQuestion.answer = answerMatch[1].toUpperCase()
      finalizeCard()
      continue
    }

    // 知识点卡片标题
    const cardTitleMatch = text.match(CARD_TITLE_RE)
    if (cardTitleMatch) {
      finalizeCard()
      currentCard = {
        title: normalizeCardTitle(cardTitleMatch[1]),
        lines: [],
      }
      continue
    }

    // 选项行（只在未进入卡片时收集）
    if (!currentCard) {
      const optMatch = text.match(OPTION_RE)
      if (optMatch) {
        currentQuestion.options.push({
          key: optMatch[1].toUpperCase(),
          text: optMatch[2].trim(),
        })
        continue
      }
    }

    // 卡片内容行
    if (currentCard) {
      currentCard.lines.push(para)
    }
  }

  finalizeModule()

  const totalQuestions = modules.reduce((s, m) => s + m.questions.length, 0)
  const totalCards = modules.reduce(
    (s, m) => s + m.questions.reduce((qs, q) => qs + q.knowledgeCards.length, 0),
    0,
  )

  return { modules, totalQuestions, totalCards }
}
