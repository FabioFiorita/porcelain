import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import {
  useWorktreeScriptsStore,
  type WorktreeScriptsTarget,
} from '@renderer/stores/worktree-scripts'
import { TestIds } from '@shared/test-ids'
import { useActions } from './actions-queries'
import { WorktreeScriptsSection } from './worktree-scripts-section'

/** Mounted only while a Project is targeted, so the closed dialog holds no Actions query. */
function WorktreeScriptsBody({ target }: { target: WorktreeScriptsTarget }): React.JSX.Element {
  const actions = useActions(true, target.projectId, target.environmentId)
  return <WorktreeScriptsSection actions={actions} editable={target.editable} showHeading={false} />
}

/**
 * One Project's Worktree lifecycle scripts, raised from the Project row in the sidebar tree.
 *
 * Actions is the list of commands a human presses. These scripts are the opposite: Porcelain
 * starts them when a Worktree is created or removed. The tree is where a Project is selected,
 * created from and removed, so it is where they are edited.
 */
export function WorktreeScriptsDialog(): React.JSX.Element {
  const target = useWorktreeScriptsStore((state) => state.target)
  const close = useWorktreeScriptsStore((state) => state.close)

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open: boolean): void => {
        if (!open) close()
      }}
    >
      <DialogContent data-testid={TestIds.hubWorktreeScriptsDialog} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Worktree scripts</DialogTitle>
          <DialogDescription>
            {target === null
              ? ''
              : `What Porcelain runs for you when a Worktree of ${target.projectName} is created or removed.`}
          </DialogDescription>
        </DialogHeader>
        {target !== null && <WorktreeScriptsBody target={target} />}
      </DialogContent>
    </Dialog>
  )
}
