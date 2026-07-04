import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { useState } from 'react'

/**
 * Rename prompt for a terminal session, mounted once in the Terminal list while a
 * session is being renamed and keyed by the session id so each open is a fresh input.
 * On confirm the caller updates both the roster label and any open terminal tab title.
 */
export function TerminalRenameDialog({
  initialName,
  onRename,
  onClose,
}: {
  initialName: string
  onRename: (name: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [name, setName] = useState(initialName)

  const submit = (): void => {
    const trimmed = name.trim()
    if (trimmed === '') return
    onRename(trimmed)
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename terminal</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Terminal name"
          aria-label="Terminal name"
          className="rounded-md"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={name.trim() === ''} onClick={submit}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
