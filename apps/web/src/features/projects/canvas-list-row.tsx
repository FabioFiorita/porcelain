import type { HubTarget } from '@porcelain/client-runtime/projects'
import type { CanvasRecord } from '@porcelain/contracts/projects'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import {
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@renderer/components/ui/sidebar'
import { useFilesScope } from '@renderer/features/files'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { targetedTab } from '@renderer/stores/hub-tabs'
import { useTabsStore } from '@renderer/stores/tabs'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { GitBranch, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useProjectOverlay, usePromoteCanvas, usePromoteProjectOverrides } from './project-data'

/**
 * One Canvas row. A tracked Canvas is already canonical in the repository — it
 * gets a badge and no promote affordance, because promoting it again would be a
 * write into the copy the daemon deliberately never writes back to.
 */
export function CanvasListRow({
  canvas,
  target,
}: {
  canvas: CanvasRecord
  target: HubTarget
}): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const { promote } = usePromoteCanvas()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const promoteNow = (): void => {
    setConfirmOpen(false)
    runUserAction(
      async () => {
        // The target checkout is always explicit: the Worktree this list is
        // scoped to, confirmed by the human. The daemon rejects a path that is
        // not a live Worktree of this Project rather than guessing one.
        await promote({
          projectId: target.projectId,
          canvasId: canvas.id,
          path: target.path,
          worktreeId: target.worktreeId,
          environmentId: target.environmentId,
        })
      },
      (error) => toastUserActionError('Promote canvas', error),
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        data-testid={TestIds.canvasListItem(canvas.id)}
        className="h-auto py-1 text-sm-minus"
        onClick={() =>
          // The exact target this list was scoped to — not activeTabTarget(),
          // which resolves to the focused Viewer tab's own target first and can
          // diverge from the selected Worktree this sidebar is showing.
          openTab(targetedTab('canvas', canvas.id, { title: canvas.title }, target))
        }
      >
        <div className="flex min-w-0 flex-col items-start">
          <span className="max-w-full truncate">{canvas.title}</span>
          <span className="max-w-full truncate text-xs text-muted-foreground">
            {canvas.kind} · {canvas.updatedAt}
          </span>
        </div>
      </SidebarMenuButton>
      {canvas.tracked ? (
        <SidebarMenuBadge data-testid={TestIds.canvasListTracked(canvas.id)}>
          Tracked
        </SidebarMenuBadge>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuAction
                data-testid={TestIds.canvasListMenu(canvas.id)}
                aria-label={`Canvas actions for ${canvas.title}`}
              >
                <MoreHorizontal />
              </SidebarMenuAction>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              data-testid={TestIds.canvasListPromote(canvas.id)}
              onClick={() => setConfirmOpen(true)}
            >
              <GitBranch />
              Promote to Git…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote {canvas.title} to Git?</AlertDialogTitle>
            <AlertDialogDescription>
              Writes the Canvas into {target.path} as a tracked `.porcelain/` file so it travels
              with the repository. Nothing is staged or committed — you decide when it enters
              history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid={TestIds.canvasPromoteConfirm} onClick={promoteNow}>
              Promote to {target.path}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarMenuItem>
  )
}

/** Track this Project's current hidden/pinned defaults into the selected checkout. */
export function TrackProjectDefaults({ target }: { target: HubTarget }): React.JSX.Element {
  const scope = useFilesScope()
  const overlay = useProjectOverlay(target.path)
  const { promote } = usePromoteProjectOverrides()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const track = (): void => {
    setConfirmOpen(false)
    runUserAction(
      async () => {
        await promote({
          projectId: target.projectId,
          path: target.path,
          hiddenPaths: [...(scope?.hiddenPaths ?? [])],
          pinnedPaths: [...(scope?.pinnedPaths ?? [])],
        })
      },
      (error) => toastUserActionError('Track project defaults', error),
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        data-testid={TestIds.canvasTrackDefaults}
        className="mx-2 justify-start text-xs text-muted-foreground"
        onClick={() => setConfirmOpen(true)}
      >
        <GitBranch />
        Track project defaults
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Track project defaults in Git?</AlertDialogTitle>
            <AlertDialogDescription>
              {overlay?.present === true
                ? `Replaces the defaults already tracked in ${target.path}.`
                : `Writes the hidden and pinned paths into ${target.path} so a clone starts focused the same way.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid={TestIds.canvasTrackDefaultsConfirm} onClick={track}>
              Track defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
