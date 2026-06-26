import type { CompletionItem, CompletionKind } from '@main/lsp'
import { cn } from '@renderer/lib/utils'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// A focus-LESS completion list anchored under the caret. It is a plain fixed-position
// element portaled to <body> — NOT a Base UI Popover. Base UI's Popover only mounts
// its popup when its internal open transition fires from a trigger interaction; an
// always-open, trigger-less popover (what a caret overlay needs) never mounts, so the
// list stayed invisible. A passive overlay like this needs none of the Popover
// machinery: the owning editor keeps focus and drives selection/accept/dismiss, and
// rows commit on `onMouseDown` + preventDefault so a click never blurs the textarea.
// Pure presentation — no tRPC, no state of its own.

// A single-character glyph per kind — enough to tell a function from a variable at a
// glance without pulling in an icon set. Unmapped kinds fall back to a dot.
const KIND_GLYPH: Record<CompletionKind, string> = {
  text: 'abc',
  method: 'ƒ',
  function: 'ƒ',
  constructor: 'ƒ',
  field: '◆',
  variable: '𝑥',
  class: '𝐂',
  interface: '𝐈',
  module: '⬡',
  property: '◆',
  unit: '∎',
  value: '=',
  enum: '⋮',
  keyword: '𝐊',
  snippet: '⌘',
  color: '●',
  file: '🖹',
  reference: '↗',
  folder: '🗀',
  enummember: '⋮',
  constant: 'π',
  struct: '𝐒',
  event: '⚡',
  operator: '±',
  typeparameter: '𝑇',
}

export interface CompletionPopupProps {
  anchor: { x: number; y: number }
  items: CompletionItem[]
  selectedIndex: number
  onAccept: (index: number) => void
  onHover: (index: number) => void
}

export function CompletionPopup({
  anchor,
  items,
  selectedIndex,
  onAccept,
  onHover,
}: CompletionPopupProps): React.JSX.Element {
  const selectedRef = useRef<HTMLButtonElement>(null)

  // Keep the selected row in view as the keyboard moves through the list.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  return createPortal(
    <div
      role="listbox"
      // `fixed` so `anchor` (viewport coords from caretRect) places it directly; the
      // caret's bottom is the top edge, nudged down 4px. max-h + scroll caps a huge list.
      className="fixed z-50 max-h-72 w-80 overflow-y-auto rounded-md bg-popover py-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{ left: anchor.x, top: anchor.y + 4 }}
    >
      {items.map((item, index) => (
        <button
          // biome-ignore lint/suspicious/noArrayIndexKey: completion labels aren't unique (overloads); the list is positionally stable per query, so index is the natural key
          key={index}
          ref={index === selectedIndex ? selectedRef : undefined}
          type="button"
          tabIndex={-1}
          // Commit on mouse DOWN with preventDefault so the textarea never loses focus
          // (a blur would tear down the popup before the click landed).
          onMouseDown={(event) => {
            event.preventDefault()
            onAccept(index)
          }}
          onMouseMove={() => onHover(index)}
          className={cn(
            'flex w-full items-center gap-2 px-2 py-1 text-left text-sm-minus',
            index === selectedIndex ? 'bg-accent text-accent-foreground' : 'text-foreground',
          )}
        >
          <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
            {KIND_GLYPH[item.kind]}
          </span>
          <span className="truncate font-mono">{item.label}</span>
          {item.detail !== undefined && (
            <span className="ml-auto truncate text-xs text-muted-foreground">{item.detail}</span>
          )}
        </button>
      ))}
    </div>,
    document.body,
  )
}
