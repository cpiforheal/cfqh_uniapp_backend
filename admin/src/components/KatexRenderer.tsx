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

export default function KatexRenderer({ block }: { block: ContentBlock }) {
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
