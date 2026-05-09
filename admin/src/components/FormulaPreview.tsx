import katex from 'katex'
import 'katex/dist/katex.min.css'
import type { ContentBlock } from '@/types/content'

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

export function FormulaPreview({ block }: { block: ContentBlock }) {
  const latex = block.latex ?? normalizeLatex(block.content)

  try {
    return (
      <span
        dangerouslySetInnerHTML={{
          __html: katex.renderToString(latex, {
            throwOnError: false,
            displayMode: block.renderMode === 'block',
          }),
        }}
      />
    )
  } catch {
    return <span>{block.content}</span>
  }
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
