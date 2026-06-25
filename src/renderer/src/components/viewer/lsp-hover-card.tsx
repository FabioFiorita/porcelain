import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

// A transient, pointer-anchored popover for LSP hover types and diagnostic
// messages. The wrapped shadcn `PopoverContent` always anchors to a
// `PopoverTrigger`; here the anchor is a *virtual element* at an arbitrary pixel
// point (under the cursor or at the caret), so we drive the Base UI primitive
// directly — same primitive, just a virtual anchor instead of a trigger element.
//
// Non-focus-stealing: the popover is rendered `open` but with no trigger, so it
// never steals the caret from the textarea. The owner controls visibility and
// dismissal (scroll/keydown/mouseleave); this component is pure presentation.

export interface HoverAnchor {
  x: number
  y: number
}

/** A Floating-UI virtual element: a zero-size rect at the given viewport point. */
function pointRect(anchor: HoverAnchor): { getBoundingClientRect: () => DOMRect } {
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

export function LspHoverCard({
  anchor,
  children,
}: {
  anchor: HoverAnchor
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <PopoverPrimitive.Root open>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={pointRect(anchor)}
          side="top"
          sideOffset={8}
          align="start"
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            // No outline/focus ring and pointer-events disabled: this is a passive
            // readout, never an interactive surface, so it can't trap the cursor.
            className="pointer-events-none z-50 max-w-md overflow-hidden rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden"
          >
            {children}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
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
