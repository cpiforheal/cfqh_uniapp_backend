// 一次性脚本：解析带背文档并写入数据库
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const docPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(__dirname, '../../精选题目带背.docx')

if (!docPath || !docPath.endsWith('.docx')) {
  console.error('用法: node scripts/import-study-cards.mjs <path-to-docx>')
  process.exit(1)
}

// 动态 import 编译后的 JS（需要先 build）
// 改用 ts-node/esm 或直接用 prisma client + 手动解析

import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

function getAttr(node, ns, local) {
  return node.getAttributeNS(ns, local) || node.getAttribute(`w:${local}`) || null
}

function parseParagraph(paraNode) {
  const segments = []
  const runs = paraNode.getElementsByTagNameNS(W_NS, 'r')
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]
    let color = null
    const rPrList = run.getElementsByTagNameNS(W_NS, 'rPr')
    if (rPrList.length > 0) {
      const rPr = rPrList[0]
      const colorNodes = rPr.getElementsByTagNameNS(W_NS, 'color')
      if (colorNodes.length > 0) {
        const val = getAttr(colorNodes[0], W_NS, 'val')
        if (val && val !== 'auto' && val !== '000000') {
          color = `#${val.toUpperCase()}`
        }
      }
    }
    const tNodes = run.getElementsByTagNameNS(W_NS, 't')
    let text = ''
    for (let j = 0; j < tNodes.length; j++) {
      text += tNodes[j].textContent || ''
    }
    if (!text) continue
    if (segments.length > 0 && segments[segments.length - 1].color === color) {
      segments[segments.length - 1].text += text
    } else {
      segments.push({ text, color })
    }
  }
  return segments
}

function segmentsToText(segs) {
  return segs.map(s => s.text).join('')
}

const CHAPTER_RE = /^([一二三四五六七八九十]+)[、．.]\s*(.+)/
const QUESTION_NUM_RE = /^(\d+)[.．]\s*(.+)/
const OPTION_RE = /^([A-Da-d])[.．．\s]\s*(.+)/
const ANSWER_RE = /^正确答案[：:]\s*([A-Da-d])/i
const CARD_TITLE_RE = /^(带背知识点[延伸]*[：:]?|题目点评[：:]?|✅[️]?带背知识点[延伸]*[：:]?|✅[️]?题目点评[：:]?)/

function normalizeCardTitle(raw) {
  return raw.replace(/^✅[️]?\s*/, '').replace(/[：:]\s*$/, '').trim()
}

const CHAPTER_CODE_MAP = {
  一: 'intro', 二: 'locomotor', 三: 'chapter3', 四: 'chapter4',
  五: 'chapter5', 六: 'chapter6', 七: 'chapter7', 八: 'chapter8',
  九: 'chapter9', 十: 'chapter10',
}

async function parseDoc(buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const xmlStr = await zip.file('word/document.xml').async('string')
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml')
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0]
  const paraNodes = body.getElementsByTagNameNS(W_NS, 'p')
  const paragraphs = []
  for (let i = 0; i < paraNodes.length; i++) {
    const node = paraNodes[i]
    const segs = parseParagraph(node)
    const text = segmentsToText(segs).trim()
    paragraphs.push({ text, node })
  }

  const modules = []
  let currentModule = null
  let currentQuestion = null
  let currentCard = null
  let moduleSort = 0

  function finalizeCard() {
    if (!currentCard || !currentQuestion) return
    const body = []
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

    const answerMatch = text.match(ANSWER_RE)
    if (answerMatch) {
      currentQuestion.answer = answerMatch[1].toUpperCase()
      finalizeCard()
      continue
    }

    const cardTitleMatch = text.match(CARD_TITLE_RE)
    if (cardTitleMatch) {
      finalizeCard()
      currentCard = { title: normalizeCardTitle(cardTitleMatch[1]), lines: [] }
      continue
    }

    if (!currentCard) {
      const optMatch = text.match(OPTION_RE)
      if (optMatch) {
        currentQuestion.options.push({ key: optMatch[1].toUpperCase(), text: optMatch[2].trim() })
        continue
      }
    }

    if (currentCard) {
      currentCard.lines.push(para)
    }
  }

  finalizeModule()
  return modules
}

async function main() {
  const buffer = readFileSync(docPath)
  console.log('解析文档...')
  const modules = await parseDoc(buffer)

  console.log(`解析完成：${modules.length} 个模块`)
  for (const mod of modules) {
    const totalCards = mod.questions.reduce((s, q) => s + q.knowledgeCards.length, 0)
    console.log(`  ${mod.moduleName}（${mod.moduleCode}）: ${mod.questions.length} 题, ${totalCards} 张卡片`)
    for (const q of mod.questions) {
      console.log(`    ${q.seq}. ${q.stem.slice(0, 30)}... 答案:${q.answer} 卡片:${q.knowledgeCards.length}`)
    }
  }

  console.log('\n写入数据库...')
  for (const mod of modules) {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.studyCardModule.findUnique({ where: { moduleCode: mod.moduleCode } })
      if (existing) {
        await tx.studyCardModule.delete({ where: { moduleCode: mod.moduleCode } })
        console.log(`  删除旧模块: ${mod.moduleCode}`)
      }
      const created = await tx.studyCardModule.create({
        data: {
          moduleCode: mod.moduleCode,
          moduleName: mod.moduleName,
          sort: mod.sort,
          status: 'published',
        },
      })
      for (const q of mod.questions) {
        const createdQ = await tx.studyCardQuestion.create({
          data: {
            moduleId: created.id,
            seq: q.seq,
            stem: q.stem,
            type: q.type,
            optionsJson: JSON.stringify(q.options),
            answer: q.answer,
            status: 'published',
          },
        })
        for (const card of q.knowledgeCards) {
          await tx.studyCardKnowledgeCard.create({
            data: {
              questionId: createdQ.id,
              seq: card.seq,
              title: card.title,
              bodyJson: JSON.stringify(card.body),
            },
          })
        }
      }
      console.log(`  导入模块: ${mod.moduleName} (${mod.questions.length} 题)`)
    })
  }

  console.log('\n导入完成！')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
