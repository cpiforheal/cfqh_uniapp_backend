import React, { useCallback, useMemo, useState } from 'react'
import { Button, Popover, Space } from 'antd'
import { BoldOutlined, BgColorsOutlined, ClearOutlined } from '@ant-design/icons'
import { BaseEditor, createEditor, Descendant, Editor, Text as SlateText, Transforms, Range } from 'slate'
import { Slate, Editable, withReact, ReactEditor, RenderLeafProps } from 'slate-react'
import { HistoryEditor, withHistory } from 'slate-history'

type CustomElement = { type: 'paragraph'; children: CustomText[] }
type CustomText = { text: string; color?: string; bold?: boolean }

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor
    Element: CustomElement
    Text: CustomText
  }
}

export interface RichTextSegment {
  text: string
  color: string | null
  bold?: boolean
}

const PRESET_COLORS = [
  '#EE0000', '#C00000', '#7030A0', '#00B050',
  '#FFC000', '#ED7D31', '#00B0F0', '#2F5496',
  '#BF8F00', '#C45911', '#92D050', '#833C0B',
]

interface Props {
  value: RichTextSegment[]
  onChange: (segments: RichTextSegment[]) => void
}

export function richSegmentsToSlate(segments: RichTextSegment[]): Descendant[] {
  if (!segments || segments.length === 0) {
    return [{ type: 'paragraph', children: [{ text: '' }] }]
  }
  const paragraphs: Descendant[] = []
  let currentChildren: any[] = []

  for (const seg of segments) {
    if (seg.text === '\n' && !seg.color && !seg.bold) {
      paragraphs.push({ type: 'paragraph', children: currentChildren.length > 0 ? currentChildren : [{ text: '' }] })
      currentChildren = []
    } else {
      currentChildren.push({
        text: seg.text,
        ...(seg.color ? { color: seg.color } : {}),
        ...(seg.bold ? { bold: true } : {}),
      })
    }
  }
  paragraphs.push({ type: 'paragraph', children: currentChildren.length > 0 ? currentChildren : [{ text: '' }] })
  return paragraphs
}

export function slateToRichSegments(nodes: Descendant[]): RichTextSegment[] {
  const segments: RichTextSegment[] = []
  for (let i = 0; i < nodes.length; i++) {
    if (i > 0) segments.push({ text: '\n', color: null })
    const node = nodes[i] as any
    const children = node.children || []
    for (const child of children) {
      if (!child.text && child.text !== '') continue
      segments.push({
        text: child.text,
        color: child.color || null,
        ...(child.bold ? { bold: true } : {}),
      })
    }
  }
  return segments
}

const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  const style: React.CSSProperties = {}
  if ((leaf as any).color) style.color = (leaf as any).color
  if ((leaf as any).bold) style.fontWeight = 'bold'
  return <span {...attributes} style={style}>{children}</span>
}

export default function RichTextEditor({ value, onChange }: Props) {
  const editor = useMemo(() => withHistory(withReact(createEditor())), [])
  const [colorOpen, setColorOpen] = useState(false)

  const initialValue = useMemo(() => richSegmentsToSlate(value), [])

  const handleChange = useCallback((newValue: Descendant[]) => {
    onChange(slateToRichSegments(newValue))
  }, [onChange])

  const toggleBold = useCallback(() => {
    const marks = Editor.marks(editor)
    if (marks && (marks as any).bold) {
      Editor.removeMark(editor, 'bold')
    } else {
      Editor.addMark(editor, 'bold', true)
    }
  }, [editor])

  const applyColor = useCallback((color: string | null) => {
    if (color) {
      Editor.addMark(editor, 'color', color)
    } else {
      Editor.removeMark(editor, 'color')
    }
    setColorOpen(false)
  }, [editor])

  const clearFormat = useCallback(() => {
    Editor.removeMark(editor, 'color')
    Editor.removeMark(editor, 'bold')
  }, [editor])

  const renderLeaf = useCallback((props: RenderLeafProps) => <Leaf {...props} />, [])

  const colorContent = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, width: 140 }}>
      {PRESET_COLORS.map((c) => (
        <div
          key={c}
          onClick={() => applyColor(c)}
          style={{ width: 28, height: 28, background: c, borderRadius: 4, cursor: 'pointer', border: '1px solid #eee' }}
        />
      ))}
      <div
        onClick={() => applyColor(null)}
        style={{ width: 28, height: 28, background: '#fff', borderRadius: 4, cursor: 'pointer', border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}
      >
        无
      </div>
    </div>
  )

  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
        <Space size={4}>
          <Button size="small" type="text" icon={<BoldOutlined />} onClick={toggleBold} title="加粗" />
          <Popover content={colorContent} trigger="click" open={colorOpen} onOpenChange={setColorOpen}>
            <Button size="small" type="text" icon={<BgColorsOutlined />} title="颜色" />
          </Popover>
          <Button size="small" type="text" icon={<ClearOutlined />} onClick={clearFormat} title="清除格式" />
        </Space>
      </div>
      <Slate editor={editor} initialValue={initialValue} onChange={handleChange}>
        <Editable
          renderLeaf={renderLeaf}
          placeholder="输入知识点内容，选中文字后可标记颜色或加粗..."
          style={{ padding: '8px 12px', minHeight: 150, outline: 'none' }}
        />
      </Slate>
    </div>
  )
}
