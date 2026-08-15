import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Textarea } from '@renderer/components/ui/textarea'
import type { WorktreeSetup } from '@renderer/stores/worktree-setup'
import { TestIds } from '@shared/test-ids'
import { useEffect, useState } from 'react'

export function WorktreeSetupDialog(props: {
  projectName: string
  setup: WorktreeSetup
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (setup: WorktreeSetup) => void
}): React.JSX.Element {
  const [startScript, setStartScript] = useState(props.setup.startScript)
  const [disposeScript, setDisposeScript] = useState(props.setup.disposeScript)

  useEffect(() => {
    if (!props.open) return
    setStartScript(props.setup.startScript)
    setDisposeScript(props.setup.disposeScript)
  }, [props.open, props.setup])

  const save = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    props.onSave({ startScript, disposeScript })
    props.onOpenChange(false)
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent data-testid={TestIds.hubWorktreeSetupDialog} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Worktree setup</DialogTitle>
          <DialogDescription>
            Configure lifecycle scripts for new worktrees in {props.projectName}. Scripts run in the
            worktree’s terminal.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={save}>
          <div className="flex flex-col gap-2">
            <label htmlFor={TestIds.hubWorktreeSetupStart} className="text-xs font-medium">
              Start script
            </label>
            <Textarea
              id={TestIds.hubWorktreeSetupStart}
              data-testid={TestIds.hubWorktreeSetupStart}
              value={startScript}
              onChange={(event) => setStartScript(event.target.value)}
              placeholder="pnpm install"
              rows={4}
              className="resize-y font-mono text-xs"
            />
            <p className="text-2xs text-muted-foreground">
              Runs automatically after a new worktree is created.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={TestIds.hubWorktreeSetupDispose} className="text-xs font-medium">
              Dispose script
            </label>
            <Textarea
              id={TestIds.hubWorktreeSetupDispose}
              data-testid={TestIds.hubWorktreeSetupDispose}
              value={disposeScript}
              onChange={(event) => setDisposeScript(event.target.value)}
              placeholder="pnpm run cleanup"
              rows={4}
              className="resize-y font-mono text-xs"
            />
            <p className="text-2xs text-muted-foreground">
              Saved for the worktree disposal action when that lifecycle action is available.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" data-testid={TestIds.hubWorktreeSetupSave}>
              Save setup
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
