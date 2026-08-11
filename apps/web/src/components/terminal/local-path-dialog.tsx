import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { useSetLocalTerminalPath } from '@renderer/hooks/use-local-terminal'
import { cn } from '@renderer/lib/utils'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { useState } from 'react'

/**
 * Why the dialog opened — drives the primary button label. The caller decides what
 * happens after save via `onSaved` (open a shell, run an action, or just keep the map).
 */
export type LocalPathDialogMode = 'spawn' | 'edit' | 'run'

/**
 * Where a "This device" terminal opens for this repo. The window runs on another
 * machine, so its repo path usually doesn't exist here; the human maps it once,
 * prefilled with the remote path since they often match. A plain field, not the
 * daemon-backed picker: that browser is wired to THIS window's daemon and would
 * browse the wrong machine. `mode: 'spawn'` opens a shell; `'edit'` fixes a stale
 * mapping; `'run'` maps before running a pending local-targeted action.
 */
export function LocalPathDialog({
  repoPath,
  initialPath,
  mode,
  onSaved,
  onClose,
}: {
  repoPath: string
  initialPath: string | null
  mode: LocalPathDialogMode
  onSaved: (localPath: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [path, setPath] = useState(initialPath ?? repoPath)
  const { save, isPending } = useSetLocalTerminalPath()

  const submit = (): void => {
    runUserAction(
      async () => {
        const trimmed = path.trim()
        if (trimmed === '') return
        await save({ repoPath, localPath: trimmed })
        onSaved(trimmed)
        onClose()
      },
      (error) => {
        toastUserActionError('Save local terminal path', error)
      },
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(open: boolean): void => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Terminal folder on this device</DialogTitle>
          <DialogDescription>
            This window works on another machine. Choose where a terminal on this device should open
            for <span className="font-mono">{repoPath}</span> — usually your local clone of the same
            repo.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={path}
          onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setPath(e.target.value)}
          onFocus={(e: React.FocusEvent<HTMLInputElement>): void => e.target.select()}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            submit()
          }}
          placeholder="/Users/you/code/app"
          aria-label="Local folder"
          data-testid={TestIds.localTerminalPathInput}
          className={cn('rounded-md font-mono')}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={path.trim() === '' || isPending}
            data-testid={TestIds.localTerminalPathSave}
            onClick={submit}
          >
            {isPending
              ? 'Saving…'
              : mode === 'spawn'
                ? 'Open terminal'
                : mode === 'run'
                  ? 'Run'
                  : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
