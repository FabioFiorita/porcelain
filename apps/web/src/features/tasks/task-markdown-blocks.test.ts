import { describe, expect, it } from 'vitest'
import {
  applyNoteBackspace,
  applyNoteEnter,
  commitNoteLine,
  editingCursor,
  parseNoteBlocks,
  serializeNoteBlocks,
  withTrailingParagraph,
} from './task-markdown-blocks'

describe('commitNoteLine', () => {
  it('turns `# Title` into a heading and leaves `#tag` as a paragraph', () => {
    expect(commitNoteLine('# Title')).toEqual({ kind: 'heading1', text: 'Title' })
    expect(commitNoteLine('## Sub')).toEqual({ kind: 'heading2', text: 'Sub' })
    expect(commitNoteLine('### Deep')).toEqual({ kind: 'heading3', text: 'Deep' })
    expect(commitNoteLine('#tag')).toEqual({ kind: 'paragraph', text: '#tag' })
    expect(commitNoteLine('#urgent-now')).toEqual({ kind: 'paragraph', text: '#urgent-now' })
    expect(commitNoteLine('- item')).toEqual({ kind: 'bullet', text: 'item' })
    expect(commitNoteLine('* item')).toEqual({ kind: 'bullet', text: 'item' })
    expect(commitNoteLine('just words')).toEqual({ kind: 'paragraph', text: 'just words' })
  })
})

describe('parseNoteBlocks / serializeNoteBlocks', () => {
  it('round-trips headings, bullets, and paragraphs as markdown', () => {
    const source = '# Title\n\nbody\n\n- one\n- two'
    const blocks = parseNoteBlocks(source)
    expect(blocks.map((block) => ({ kind: block.kind, text: block.text }))).toEqual([
      { kind: 'heading1', text: 'Title' },
      { kind: 'paragraph', text: 'body' },
      { kind: 'bullet', text: 'one' },
      { kind: 'bullet', text: 'two' },
    ])
    expect(serializeNoteBlocks(blocks)).toBe(source)
  })

  it('keeps a trailing empty paragraph for typing without writing it back', () => {
    const blocks = withTrailingParagraph(parseNoteBlocks('# Title'))
    expect(blocks).toHaveLength(2)
    expect(blocks[1]?.kind).toBe('paragraph')
    expect(blocks[1]?.text).toBe('')
    expect(serializeNoteBlocks(blocks)).toBe('# Title')
  })
})

describe('applyNoteEnter', () => {
  it('commits the typed line and opens a new paragraph underneath', () => {
    const start = parseNoteBlocks('')
    const next = applyNoteEnter(start, 0, '# Hello notes')
    expect(next.blocks[0]).toMatchObject({ kind: 'heading1', text: 'Hello notes' })
    expect(next.blocks[1]).toMatchObject({ kind: 'paragraph', text: '' })
    expect(next.focus).toBe(1)
    expect(serializeNoteBlocks(next.blocks)).toBe('# Hello notes')
  })
})

describe('applyNoteBackspace', () => {
  it('deletes an empty line and returns to the previous block', () => {
    const start = applyNoteEnter(parseNoteBlocks(''), 0, '# Title')
    const back = applyNoteBackspace(start.blocks, start.focus, '')
    expect(back).not.toBeNull()
    expect(back?.focus).toBe(0)
    expect(back?.blocks).toHaveLength(1)
    expect(back?.blocks[0]).toMatchObject({ kind: 'heading1', text: 'Title' })
  })

  it('does not delete the last remaining line', () => {
    expect(applyNoteBackspace(parseNoteBlocks(''), 0, '')).toBeNull()
  })
})

describe('editingCursor', () => {
  it('maps the caret in the active line onto the serialized notes', () => {
    const blocks = parseNoteBlocks('# Title')
    const withDraft = withTrailingParagraph(blocks)
    expect(editingCursor(withDraft, 1, 'see @src', 8)).toBe('# Title\n\nsee @src'.length)
    expect(editingCursor(parseNoteBlocks(''), 0, 'see @src', 8)).toBe(8)
  })
})
