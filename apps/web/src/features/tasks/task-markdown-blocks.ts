export type NoteBlockKind = 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'bullet'

export type NoteBlock = {
  readonly id: string
  readonly kind: NoteBlockKind
  readonly text: string
}

let nextBlockId = 1

function newNoteBlock(kind: NoteBlockKind = 'paragraph', text = ''): NoteBlock {
  nextBlockId += 1
  return { id: `note-${nextBlockId}`, kind, text }
}

/** Source form of a committed block — `# Title` while editing a heading. */
export function blockSource(block: NoteBlock): string {
  if (block.kind === 'heading1') return `# ${block.text}`
  if (block.kind === 'heading2') return `## ${block.text}`
  if (block.kind === 'heading3') return `### ${block.text}`
  if (block.kind === 'bullet') return `- ${block.text}`
  return block.text
}

/** Commit a typed line: `# Title` + Enter becomes a heading and the hash leaves the display. */
export function commitNoteLine(source: string): Pick<NoteBlock, 'kind' | 'text'> {
  const line = source.replace(/\s+$/, '')
  const heading = /^(#{1,3})[ \t]+(.*)$/.exec(line)
  if (heading !== null) {
    const level = heading[1]?.length ?? 1
    const kind: NoteBlockKind = level === 1 ? 'heading1' : level === 2 ? 'heading2' : 'heading3'
    return { kind, text: (heading[2] ?? '').trim() }
  }
  const bullet = /^[-*][ \t]+(.*)$/.exec(line)
  if (bullet !== null) return { kind: 'bullet', text: (bullet[1] ?? '').trim() }
  return { kind: 'paragraph', text: line }
}

export function parseNoteBlocks(markdown: string): NoteBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: NoteBlock[] = []
  for (const line of lines) {
    if (line.trim() === '') continue
    const committed = commitNoteLine(line)
    blocks.push(newNoteBlock(committed.kind, committed.text))
  }
  if (blocks.length === 0) blocks.push(newNoteBlock())
  return blocks
}

export function serializeNoteBlocks(blocks: readonly NoteBlock[]): string {
  const lines: string[] = []
  for (const [index, block] of blocks.entries()) {
    if (block.kind === 'bullet') {
      lines.push(`- ${block.text}`)
      const next = blocks[index + 1]
      if (next !== undefined && next.kind !== 'bullet') lines.push('')
      continue
    }
    if (block.kind === 'heading1') lines.push(`# ${block.text}`)
    else if (block.kind === 'heading2') lines.push(`## ${block.text}`)
    else if (block.kind === 'heading3') lines.push(`### ${block.text}`)
    else if (block.text !== '') lines.push(block.text)
    if (block.text !== '' || block.kind !== 'paragraph') lines.push('')
  }
  return lines.join('\n').replace(/\n+$/, '')
}

/** Keep a blank line at the end so the document stays typeable. */
export function withTrailingParagraph(blocks: readonly NoteBlock[]): NoteBlock[] {
  const last = blocks[blocks.length - 1]
  if (last !== undefined && last.kind === 'paragraph' && last.text === '') return [...blocks]
  return [...blocks, newNoteBlock()]
}

/** Emit the in-progress line as-is so `# Title` stays a draft until Enter. */
export function editingBlocks(
  blocks: readonly NoteBlock[],
  index: number,
  draft: string,
): NoteBlock[] {
  return blocks.map((block, i) =>
    i === index ? { ...block, kind: 'paragraph', text: draft } : block,
  )
}

export function editingCursor(
  blocks: readonly NoteBlock[],
  index: number,
  draft: string,
  cursorInDraft: number,
): number {
  const prefix = serializeNoteBlocks(editingBlocks(blocks, index, draft).slice(0, index + 1))
  const start =
    draft !== '' && prefix.endsWith(draft) ? prefix.length - draft.length : prefix.length
  return start + cursorInDraft
}

export function applyNoteEnter(
  blocks: readonly NoteBlock[],
  index: number,
  source: string,
): { blocks: NoteBlock[]; focus: number } {
  const committed = commitNoteLine(source)
  const next = blocks.map((block, i) => (i === index ? { ...block, ...committed } : block))
  next.splice(index + 1, 0, newNoteBlock())
  return { blocks: next, focus: index + 1 }
}

export function applyNoteBackspace(
  blocks: readonly NoteBlock[],
  index: number,
  source: string,
): { blocks: NoteBlock[]; focus: number } | null {
  if (source !== '' || index === 0) return null
  const next = blocks.filter((_, i) => i !== index)
  return { blocks: next.length === 0 ? [newNoteBlock()] : next, focus: index - 1 }
}
