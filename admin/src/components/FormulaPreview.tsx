import { lazy, Suspense, useMemo } from 'react'
import type { ContentBlock } from '@/types/content'

const KatexRenderer = lazy(() => import('./KatexRenderer'))

export function FormulaPreview({ block }: { block: ContentBlock }) {
  return (
    <Suspense fallback={<span>{block.content}</span>}>
      <KatexRenderer block={block} />
    </Suspense>
  )
}

export function ContentBlocksPreview({ blocks }: { blocks: ContentBlock[] }) {
  if (blocks.length === 0) return <span>未识别</span>

  return (
    <div>
      {blocks.map((block, index) => (
        <div key={`${block.type}-${index}`} style={{ marginBottom: 6 }}>
          {block.type === 'formula_text' ? <FormulaPreview block={block} /> : <span>{block.content}</span>}
        </div>
      ))}
    </div>
  )
}
