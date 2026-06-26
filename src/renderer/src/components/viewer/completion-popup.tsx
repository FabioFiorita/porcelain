import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import type { CompletionItem, CompletionKind } from '@main/lsp'
import { cn } from '@renderer/lib/utils'
import { useEffect, useRef } from 'react'

// A focus-LESS completion list anchored under the caret. Like LspHoverCard, it's an
// open Popover with no trigger anchored to a virtual element, so it never steals the
// caret from the textarea: the owning editor keeps focus and drives selection/accept
// via keyboard. Mouse selection uses onMouseDown + preventDefault so a click commits
// without first blurring the textarea (which would dismiss the popup before the click
// resolved). Pure presentation — no tRPC, no state of its own.

/** A Floating-UI virtual element: a zero-size rect at the given viewport point. */
function pointRect(anchor: { x: number; y: number }): { getBoundingClientRect: () => DOMRect } {
  return {
    getBoundingClientRect: () =>
      ({
        x: anchor.x,
        y: anchor.y,
        width: 0,
        height: 0,
        top: anchor.y,
        left: anchor.x,
        right: anchor.x,
        bottom: anchor.y,
        toJSON: () => ({}),
      }) as DOMRect,
  }
}

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

  return (
    <PopoverPrimitive.Root open>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={pointRect(anchor)}
          side="bottom"
          sideOffset={4}
          align="start"
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            // tabIndex -1: it can hold a programmatic focus target but isn't in the tab
            // order — the textarea keeps the caret; we never blur it.
            tabIndex={-1}
            className="z-50 max-h-72 w-80 overflow-y-auto rounded-md bg-popover py-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden"
          >
            {items.map((item, index) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: completion labels aren't unique (overloads); the list is positionally stable per query, so index is the natural key
                key={index}
                ref={index === selectedIndex ? selectedRef : undefined}
                type="button"
                tabIndex={-1}
                // Commit on mouse DOWN with preventDefault so the textarea never loses
                // focus (a blur would tear down the popup before the click landed).
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
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {item.detail}
                  </span>
                )}
              </button>
            ))}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
