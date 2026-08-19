import type { HubWorktree } from '@porcelain/contracts/projects'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpcClient } from '@renderer/lib/trpc'
import { cn } from '@renderer/lib/utils'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { useEffect } from 'react'
import { HubTreeFromInventories } from './hub-tree-list'
import {
  type HubInventoryView,
  useCreateHubWorktree,
  useHubInventories,
  useOpenProject,
  useRemoveHubProject,
  useRemoveHubWorktree,
  useSelectedProject,
} from './project-data'

export function HubTree(props: { className?: string }): React.JSX.Element | null {
  const inventories = useHubInventories()
  const createWorktree = useCreateHubWorktree()
  const openProject = useOpenProject()
  const removeProject = useRemoveHubProject()
  const removeWorktree = useRemoveHubWorktree()
  const selectWorktree = useHubSelectionStore((state) => state.selectWorktree)
  const selection = useHubSelectionStore((state) => state.selection)
  const selectedProject = useSelectedProject()

  useEffect(() => {
    if (inventories.length === 0) return
    if (selection.kind === 'worktree') {
      const stillThere = inventories.some((source) =>
        source.inventory.projects.some((project) =>
          project.worktrees.some((worktree) => worktree.id === selection.worktreeId),
        ),
      )
      if (!stillThere) {
        // Keep the restored Project; only drop the stale Hub row so the effect
        // below can bind Home to whichever checkout boot actually opened.
        useHubSelectionStore.setState({ selection: { kind: 'home' } })
      }
      return
    }
    const current = inventories.find((source) => source.current)
    if (selection.kind !== 'home' || selectedProject === null || current === undefined) return
    for (const project of current.inventory.projects) {
      const worktree = project.worktrees.find((entry) => entry.path === selectedProject.path)
      if (worktree === undefined) continue
      selectWorktree({
        environmentId: current.inventory.environment.id,
        projectId: project.id,
        worktreeId: worktree.id,
        path: worktree.path,
        name: worktree.name,
      })
      return
    }
  }, [inventories, selectedProject, selection, selectWorktree])

  if (inventories.length === 0) return null

  const open = (source: HubInventoryView, worktree: HubWorktree): void => {
    // Electron: `source.environmentId` is a SHELL identity (null = the local daemon, a
    // string = a saved environment group), not one the renderer can resolve — its session
    // resolver only knows the browser's own localStorage connections, so every non-current
    // source used to fail as "offline" and the local row on a remote-bound window opened a
    // local path against the remote daemon ("Project path was not found"). The renderer has
    // one daemon client, its window's; anything else has to go through the shell.
    const select = (): void => {
      selectWorktree({
        environmentId: source.inventory.environment.id,
        projectId: worktree.projectId,
        worktreeId: worktree.id,
        path: worktree.path,
        name: worktree.name,
      })
    }
    if (!isBrowser && !source.current) {
      // The shell reloads this window onto the target daemon, and the Hub selection is
      // persisted through that reload — so it has to name the DESTINATION before the
      // switch. Left on the origin Environment, the restored selection would carry an id
      // that is no longer primary and every panel keyed off it (Files, Git, Search,
      // Terminal, Actions) would read "offline" instead of the open action.
      const previous = useHubSelectionStore.getState().selection
      select()
      runUserAction(
        () =>
          shellTrpcClient.openWorktreeInEnvironment.mutate({
            environmentId: source.environmentId,
            repoPath: worktree.path,
          }),
        (error) => {
          // No reload happened, so put the tree back where the human left it.
          useHubSelectionStore.setState({ selection: previous })
          toastUserActionError('Open worktree', error)
        },
      )
      return
    }
    select()
    runUserAction(
      () =>
        openProject.open(worktree.path, {
          // Session-routing identity, not the persisted-selection one above: null
          // means "use this window's own client directly", which is what `current`
          // sources need — `source.inventory.environment.id` is the daemon's own
          // real id even when local, and environmentSessionFor() only recognizes
          // it as local once the primary Environment id has round-tripped through
          // daemonInfo, so passing it here treated the local Environment as an
          // unresolved remote session and failed every worktree switch as offline.
          environmentId: isBrowser ? source.environmentId : null,
        }),
      (error) => toastUserActionError('Open worktree', error),
    )
  }

  if (inventories.every((source) => source.inventory.projects.length === 0)) {
    return (
      <div
        data-testid={TestIds.hubInventory}
        className={cn('flex w-full max-w-sm flex-col gap-3', props.className)}
      >
        <p className="px-2 text-xs text-muted-foreground">
          Open a Git repository to add it to this Environment.
        </p>
      </div>
    )
  }

  return (
    <HubTreeFromInventories
      sources={inventories}
      className={props.className}
      creating={createWorktree.isPending}
      removeProject={removeProject.remove}
      removeWorktree={removeWorktree.remove}
      openWorktree={open}
      createWorktree={async (input) => {
        return createWorktree.create(input)
      }}
    />
  )
}
