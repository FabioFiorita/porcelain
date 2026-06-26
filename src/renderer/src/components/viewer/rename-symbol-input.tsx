import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import { useState } from 'react'
import { createPortal } from 'react-dom'

// A small focus-BEARING input for renaming the symbol under the caret. A plain
// fixed-position element portaled to <body> — NOT a Base UI Popover (which never mounts
// an always-open, trigger-less popover, the reason the other LSP overlays render this
// way too). Unlike CompletionPopup it TAKES focus: the input autofocuses and selects-all
// so the user can type a replacement immediately. Enter submits the trimmed name, Esc
// cancels. Pure UI — the owner runs the actual rename and feeds back `busy`/`error`.

export interface RenameAnchor {
  x: number
  y: number
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

  return createPortal(
    <div
      className="fixed z-50 flex flex-col gap-1 rounded-md bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{ left: anchor.x, top: anchor.y + 4 }}
    >
      <Input
        autoFocus
        value={name}
        disabled={busy}
        aria-label="New name"
        aria-invalid={error !== null}
        onChange={(event) => setName(event.target.value)}
        onFocus={(event) => event.target.select()}
        // The editor's textarea loses focus to this input, which fires its
        // onBlur-driven close paths in the owner; closing the input is handled by
        // Esc / submit, so the blur of THIS input (e.g. clicking away) cancels.
        onBlur={onCancel}
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
    </div>,
    document.body,
  )
}
