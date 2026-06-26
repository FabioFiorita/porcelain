import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import { useState } from 'react'

// A small focus-BEARING input popover for renaming the symbol under the caret. Unlike
// CompletionPopup (which must never steal the caret from the textarea), this one TAKES
// focus: the input autofocuses and selects-all so the user can type a replacement
// immediately. Enter submits the trimmed name, Esc cancels. Anchored to a virtual
// element at the caret point, same as the other LSP popovers. Pure UI — the owner runs
// the actual rename and feeds back `busy`/`error`.

export interface RenameAnchor {
  x: number
  y: number
}

/** A Floating-UI virtual element: a zero-size rect at the given viewport point. */
function pointRect(anchor: RenameAnchor): { getBoundingClientRect: () => DOMRect } {
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

export interface RenameSymbolInputProps {
  anchor: RenameAnchor
  initialName: string
  busy: boolean
  error: string | null
  onSubmit: (name: string) => void
  onCancel: () => void
}

export function RenameSymbolInput({
  anchor,
  initialName,
  busy,
  error,
  onSubmit,
  onCancel,
}: RenameSymbolInputProps): React.JSX.Element {
  const [name, setName] = useState(initialName)

  const submit = (): void => {
    const trimmed = name.trim()
    if (trimmed === '' || busy) return
    onSubmit(trimmed)
  }

  return (
    <PopoverPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={pointRect(anchor)}
          side="bottom"
          sideOffset={4}
          align="start"
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup className="z-50 flex flex-col gap-1 rounded-md bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden">
            <Input
              autoFocus
              value={name}
              disabled={busy}
              aria-label="New name"
              aria-invalid={error !== null}
              onChange={(event) => setName(event.target.value)}
              onFocus={(event) => event.target.select()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submit()
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  onCancel()
                }
              }}
              className={cn('h-7 w-56 font-mono', busy && 'opacity-70')}
            />
            {error !== null && <span className="px-1 text-xs text-destructive">{error}</span>}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
