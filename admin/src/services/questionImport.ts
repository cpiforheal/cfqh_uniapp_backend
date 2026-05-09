import { adminFetch } from './adminApi'

export interface QuestionImportIssue {
  level: 'warning' | 'error'
  message: string
}

export interface QuestionImportItem {
  id: string
  title: string
  stem: string
  type: 'single_choice' | 'multiple_choice' | 'judgment' | 'short_answer' | 'case_analysis'
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

export interface QuestionImportPreview {
  summary: {
    total: number
    ready: number
    needsReview: number
    matchedAnswers: number
    missingAnswers: number
    optionIssueCount: number
    duplicateCount: number
  }
  items: QuestionImportItem[]
}

export interface QuestionImportCommitResult {
  imported: number
  failed: number
  failures: Array<{ title?: string; message: string }>
}

export function previewQuestionImport(questionDoc: File, answerDoc?: File) {
  const formData = new FormData()
  formData.append('questionDoc', questionDoc)
  if (answerDoc) formData.append('answerDoc', answerDoc)
  return adminFetch<QuestionImportPreview>('/admin/question-imports/preview', {
    method: 'POST',
    body: formData,
  })
}

export function commitQuestionImport(items: QuestionImportItem[]) {
  const batchSize = 200
  const batches: QuestionImportItem[][] = []
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize))
  }

  return batches.reduce<Promise<QuestionImportCommitResult>>(
    async (previous, batch) => {
      const summary = await previous
      const result = await adminFetch<QuestionImportCommitResult>('/admin/question-imports/commit', {
        method: 'POST',
        body: JSON.stringify({ items: batch }),
      })
      return {
        imported: summary.imported + result.imported,
        failed: summary.failed + result.failed,
        failures: [...summary.failures, ...result.failures],
      }
    },
    Promise.resolve({ imported: 0, failed: 0, failures: [] }),
  )
}
