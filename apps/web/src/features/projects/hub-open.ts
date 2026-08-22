import type { HubWorktree } from '@porcelain/contracts/projects'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpcClient } from '@renderer/lib/trpc'
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
    // Electron: `source.environmentId` is a SHELL identity (null = the local daemon, a
    // string = a saved environment group), not the daemon-announced one the Hub selection
    // records. Opening a checkout binds the WINDOW to its daemon, so a non-current source
    // goes through the shell — the renderer's own session to that Environment is for reads
    // and terminals, not for repointing the window.
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
}
