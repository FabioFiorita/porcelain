import { createPortal } from 'react-dom'

// A transient, point-anchored readout for LSP hover types and diagnostic messages.
// A plain fixed-position element portaled to <body> — NOT a Base UI Popover. Base UI's
// Popover only mounts its popup once its open transition fires from a trigger
// interaction; an always-open, trigger-less popover (what a cursor/caret overlay needs)
// never mounts, so the card stayed invisible. This is a passive readout — the editor
// owns visibility and dismissal (scroll/keydown/mouseleave) — so it needs none of the
// Popover machinery; pointer-events stay off so it can never trap the cursor.

export interface HoverAnchor {
  x: number
  y: number
}

export function LspHoverCard({
  anchor,
  children,
}: {
  anchor: HoverAnchor
  children: React.ReactNode
}): React.JSX.Element {
  return createPortal(
    <div
      // `translateY(-100%)` sits the card ABOVE the cursor point (its bottom edge 8px
      // above `anchor.y`) without needing to know its height first.
      className="pointer-events-none fixed z-50 max-w-md overflow-hidden rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{ left: anchor.x, top: anchor.y - 8, transform: 'translateY(-100%)' }}
    >
      {children}
    </div>,
    document.body,
  )
}

// LSP hover markdown for TS is one or more fenced code blocks plus optional prose.
// We don't pull in a markdown renderer — strip the ``` fences and show the body as
// monospace, which is exactly the type signature the user wants to read.
export function stripHoverFences(markdown: string): string {
  return markdown
    .replace(/```[a-zA-Z]*\n?/g, '')
    .replace(/```/g, '')
    .trim()
}
