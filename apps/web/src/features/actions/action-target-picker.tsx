import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { TestIds } from '@shared/test-ids'
import { GitBranch } from 'lucide-react'
import type { ActionsWorktree } from './actions-scope'

/**
 * "Which checkout?" — raised when a run has no explicit Worktree target.
 *
 * A Project can have any number of Worktrees and Porcelain will not pick one for you:
 * running `pnpm dev` in the wrong checkout is exactly the mistake the Hub exists to
 * prevent. So the human either has a Worktree selected (the target is then implicit and
 * visible in the breadcrumb) or they answer this question before anything runs.
 */
export function ActionTargetPicker({
  actionTitle,
  environmentName,
  worktrees,
  open,
  onCancel,
  onPick,
}: {
  actionTitle: string
  environmentName: string
  worktrees: readonly ActionsWorktree[]
  open: boolean
  onCancel: () => void
  onPick: (worktree: ActionsWorktree) => void
}): React.JSX.Element {
  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-lg" data-testid={TestIds.actionsTargetPicker}>
        <DialogHeader>
          <DialogTitle>Run “{actionTitle}” in which Worktree?</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          On {environmentName}. Porcelain never guesses which checkout a command runs in.
        </p>
        <div className="flex max-h-72 flex-col gap-1 overflow-auto">
          {worktrees.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">
              This Environment currently lists no Worktree for this Project.
            </p>
          ) : (
            worktrees.map((worktree) => (
              <button
                key={worktree.id}
                type="button"
                data-testid={TestIds.actionsTargetOption(worktree.id)}
                onClick={() => onPick(worktree)}
                className="flex min-w-0 items-center gap-2 rounded-xl border bg-card p-2 text-left"
              >
                <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{worktree.branch}</span>
                  <span className="block truncate font-mono text-2xs text-muted-foreground">
                    {worktree.path}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
