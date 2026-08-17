import { cn } from '@renderer/lib/utils'
import { TestIds } from '@shared/test-ids'
import { useLayoutEffect, useRef, useState } from 'react'
import {
  applyNoteBackspace,
  applyNoteEnter,
  blockSource,
  commitNoteLine,
  editingBlocks,
  editingCursor,
  type NoteBlock,
  type NoteBlockKind,
  parseNoteBlocks,
  serializeNoteBlocks,
  withTrailingParagraph,
} from './task-markdown-blocks'

function blockAt(blocks: readonly NoteBlock[], index: number): NoteBlock {
  return blocks[index] ?? { id: 'note-fallback', kind: 'paragraph', text: '' }
}

function blockClass(kind: NoteBlockKind): string {
  if (kind === 'heading1') return 'text-2xl font-semibold tracking-tight'
  if (kind === 'heading2') return 'text-xl font-semibold tracking-tight'
  if (kind === 'heading3') return 'text-lg font-semibold tracking-tight'
  if (kind === 'bullet') return 'text-sm'
  return 'text-sm'
}

function HeadingTag({
  kind,
  text,
  onEdit,
}: {
  kind: 'heading1' | 'heading2' | 'heading3'
  text: string
  onEdit: () => void
}): React.JSX.Element {
  const Tag = kind === 'heading1' ? 'h1' : kind === 'heading2' ? 'h2' : 'h3'
  return (
    <Tag className={cn(blockClass(kind), 'cursor-text rounded-sm px-1')} onClick={onEdit}>
      {text === '' ? '\u00a0' : text}
    </Tag>
  )
}

function assignRef(
  ref: React.Ref<HTMLTextAreaElement> | undefined,
  el: HTMLTextAreaElement | null,
): void {
  if (ref == null) return
  if (typeof ref === 'function') ref(el)
  else ref.current = el
}

export function TaskMarkdownEditor({
  notes,
  onChange,
  inputRef,
  onCursor,
  onKeyDown,
  onPaste,
  children,
}: {
  notes: string
  onChange: (notes: string, cursor: number) => void
  inputRef?: React.Ref<HTMLTextAreaElement>
  onCursor?: (cursor: number) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void
  children?: React.ReactNode
}): React.JSX.Element {
  const initial = withTrailingParagraph(parseNoteBlocks(notes))
  const [blocks, setBlocks] = useState<NoteBlock[]>(initial)
  const [focusIndex, setFocusIndex] = useState(Math.max(0, initial.length - 1))
  const [draft, setDraft] = useState(() => blockSource(blockAt(initial, initial.length - 1)))
  const emitted = useRef(notes)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const skipFocus = useRef(true)
  const blocksRef = useRef(blocks)
  const focusRef = useRef(focusIndex)
  blocksRef.current = blocks
  focusRef.current = focusIndex

  useLayoutEffect(() => {
    if (notes === emitted.current) return
    const prior = blocksRef.current
    const next = withTrailingParagraph(parseNoteBlocks(notes))
    const nextFocus = Math.min(focusRef.current, next.length - 1)
    emitted.current = notes
    setBlocks(next.map((block, i) => ({ ...block, id: prior[i]?.id ?? block.id })))
    setFocusIndex(nextFocus)
    setDraft(blockSource(blockAt(next, nextFocus)))
  }, [notes])

  useLayoutEffect(() => {
    if (skipFocus.current) {
      skipFocus.current = false
      return
    }
    const el = textareaRef.current
    if (el === null || focusIndex < 0) return
    el.focus()
    const pos = el.value.length
    el.setSelectionRange(pos, pos)
  }, [focusIndex])

  const emit = (
    next: NoteBlock[],
    index: number,
    nextDraft: string,
    cursorInDraft: number,
  ): void => {
    const serialized = serializeNoteBlocks(editingBlocks(next, index, nextDraft))
    emitted.current = serialized
    onChange(serialized, editingCursor(next, index, nextDraft, cursorInDraft))
  }

  const focusBlock = (index: number): void => {
    const committed = commitNoteLine(draft)
    const next = blocks.map((block, i) => (i === focusIndex ? { ...block, ...committed } : block))
    const ready = withTrailingParagraph(next)
    const nextFocus = Math.min(index, ready.length - 1)
    setBlocks(ready)
    setFocusIndex(nextFocus)
    const nextDraft = blockSource(blockAt(ready, nextFocus))
    setDraft(nextDraft)
    emit(ready, nextFocus, nextDraft, nextDraft.length)
  }

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const value = event.target.value
    const cursor = event.target.selectionStart ?? value.length
    setDraft(value)
    emit(blocks, focusIndex, value, cursor)
    onCursor?.(editingCursor(blocks, focusIndex, value, cursor))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    const cursor = event.currentTarget.selectionStart ?? draft.length
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      const result = applyNoteEnter(blocks, focusIndex, draft)
      const ready = withTrailingParagraph(result.blocks)
      setBlocks(ready)
      setFocusIndex(result.focus)
      setDraft('')
      emit(ready, result.focus, '', 0)
      return
    }
    if (event.key === 'Backspace' && cursor === 0) {
      const result = applyNoteBackspace(blocks, focusIndex, draft)
      if (result === null) return
      event.preventDefault()
      const ready = withTrailingParagraph(result.blocks)
      const nextDraft = blockSource(blockAt(ready, result.focus))
      setBlocks(ready)
      setFocusIndex(result.focus)
      setDraft(nextDraft)
      emit(ready, result.focus, nextDraft, nextDraft.length)
      return
    }
    if (event.key === 'ArrowUp' && cursor === 0 && focusIndex > 0) {
      event.preventDefault()
      focusBlock(focusIndex - 1)
      return
    }
    if (event.key === 'ArrowDown' && cursor === draft.length && focusIndex < blocks.length - 1) {
      event.preventDefault()
      focusBlock(focusIndex + 1)
    }
  }

  const preview = commitNoteLine(draft)

  return (
    <div
      data-testid={TestIds.tasksComposerMarkdown}
      className="flex min-h-28 flex-col gap-1 rounded-2xl border border-transparent bg-input/50 px-3 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30"
    >
      {blocks.map((block, index) => {
        if (index === focusIndex) {
          return (
            <div key={block.id} className="relative">
              {preview.kind === 'bullet' && (
                <span className="pointer-events-none absolute top-1 left-1 text-sm text-muted-foreground">
                  •
                </span>
              )}
              <textarea
                ref={(el) => {
                  textareaRef.current = el
                  assignRef(inputRef, el)
                }}
                data-testid={TestIds.tasksComposerNotes}
                aria-label="Describe the task"
                placeholder="Markdown notes. # Title + Enter · @ a file · #tag · paste a link or image."
                rows={1}
                className={cn(
                  'w-full resize-none bg-transparent px-1 py-0.5 outline-none placeholder:text-muted-foreground',
                  'field-sizing-content',
                  blockClass(preview.kind),
                  preview.kind === 'bullet' && 'pl-5',
                )}
                value={draft}
                onChange={handleChange}
                onClick={(event) =>
                  onCursor?.(
                    editingCursor(blocks, focusIndex, draft, event.currentTarget.selectionStart),
                  )
                }
                onKeyUp={(event) =>
                  onCursor?.(
                    editingCursor(blocks, focusIndex, draft, event.currentTarget.selectionStart),
                  )
                }
                onKeyDown={handleKeyDown}
                onPaste={onPaste}
              />
              {children}
            </div>
          )
        }
        if (block.kind === 'heading1' || block.kind === 'heading2' || block.kind === 'heading3') {
          return (
            <HeadingTag
              key={block.id}
              kind={block.kind}
              text={block.text}
              onEdit={() => focusBlock(index)}
            />
          )
        }
        if (block.kind === 'bullet') {
          return (
            <button
              key={block.id}
              type="button"
              className="flex cursor-text items-start gap-2 px-1 text-left"
              onClick={() => focusBlock(index)}
            >
              <span className="text-sm leading-5">•</span>
              <span className={blockClass('bullet')}>
                {block.text === '' ? '\u00a0' : block.text}
              </span>
            </button>
          )
        }
        if (block.text === '') return <div key={block.id} className="h-5" />
        return (
          <button
            key={block.id}
            type="button"
            className={cn(blockClass('paragraph'), 'cursor-text rounded-sm px-1 text-left')}
            onClick={() => focusBlock(index)}
          >
            {block.text}
          </button>
        )
      })}
    </div>
  )
}
