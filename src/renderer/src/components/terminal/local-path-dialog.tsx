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
import { useSetLocalTerminalPath } from '@renderer/hooks/use-local-terminal'
import { cn } from '@renderer/lib/utils'
import { TestIds } from '@shared/test-ids'
import { useState } from 'react'

/**
 * Where a "This device" terminal should open for this repo.
 *
 * The window is working on another machine, so the repo's path there
 * (`/home/you/code/app`) usually doesn't exist here (`~/code/app`) — the human maps it
 * once and we remember it per repo + environment (main/local-terminal-paths.ts). It's
 * prefilled with the remote path because the two often DO match, and matching is the case
 * worth making one keystroke.
 *
 * Deliberately a plain path field rather than the daemon-backed directory browser the repo
 * picker uses: that browser is wired to this window's daemon, so it would browse the wrong
 * machine — the exact confusion this feature exists to remove.
 */
export function LocalPathDialog({
  repoPath,
  initialPath,
  onSaved,
  onClose,
}: {
  repoPath: string
  initialPath: string | null
  onSaved: (localPath: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [path, setPath] = useState(initialPath ?? repoPath)
  const { save, isPending } = useSetLocalTerminalPath()

  const submit = async (): Promise<void> => {
    const trimmed = path.trim()
    if (trimmed === '') return
    await save({ repoPath, localPath: trimmed })
    onSaved(trimmed)
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
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
          onChange={(e) => setPath(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={async (e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            await submit()
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
            {isPending ? 'Saving…' : 'Open terminal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
