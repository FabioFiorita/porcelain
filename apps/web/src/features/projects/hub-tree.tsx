import type { HubWorktree } from '@porcelain/contracts/projects'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
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
    selectWorktree({
      environmentId: source.inventory.environment.id,
      projectId: worktree.projectId,
      worktreeId: worktree.id,
      path: worktree.path,
      name: worktree.name,
    })
    runUserAction(
      () =>
        openProject.open(worktree.path, {
          environmentId: source.inventory.environment.id,
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
