import type { HubWorktree } from '@porcelain/contracts/projects'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { runUserAction } from '@shared/background'
import { type HubInventoryView, useOpenProject } from './project-data'

/**
 * Open one Hub checkout — the single path every surface that offers "work on this one" uses.
 *
 * Extracted from the Hub tree because it is not tree behavior: the rules below are about
 * which daemon owns a checkout, and any list that names a Worktree (the tree, Settings, a
 * command) has to follow the same ones or it opens a path on the wrong machine.
 */
export function useOpenHubWorktree(): (source: HubInventoryView, worktree: HubWorktree) => void {
  const openProject = useOpenProject()
  const selectWorktree = useHubSelectionStore((state) => state.selectWorktree)

  return (source: HubInventoryView, worktree: HubWorktree): void => {
    // `source.environmentId` is a shell connection identity in Electron and null in the
    // browser's primary source. The persisted selection always uses the daemon-announced id;
    // the open call below uses that same id so the existing renderer session owns the request.
    const select = (): void => {
      selectWorktree({
        environmentId: source.inventory.environment.id,
        projectId: worktree.projectId,
        worktreeId: worktree.id,
        path: worktree.path,
        name: worktree.name,
      })
    }
    select()
    runUserAction(
      () =>
        openProject.open(worktree.path, {
          // null means this window's own daemon. For a secondary source, use its
          // daemon-announced identity; hub-inventories registered the alias to the live
          // Electron or browser connection before the row became actionable.
          environmentId: source.current ? null : source.inventory.environment.id,
        }),
      (error) => toastUserActionError('Open worktree', error),
    )
  }
}
