import type { ActionView } from '@porcelain/contracts/actions'
import { useHubInventories } from '@renderer/features/projects'
import { environmentSessionFor } from '@renderer/lib/environment-sessions'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpcClient } from '@renderer/lib/trpc'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { useQuery } from '@tanstack/react-query'

/**
 * Which Project the Hub's top-corner Actions menu is showing, and where its
 * equivalents live.
 *
 * Actions are stored per Project, but a Project id is Environment-local:
 * the same repository open on a Mac and on a Linux box is two Project records that
 * the Hub groups by `groupingKey`. The menu therefore shows the selected Project's
 * commands first and lists the sibling Environments underneath, so it is always
 * obvious which machine a command would run on.
 */

export type ActionsWorktree = Readonly<{
  id: string
  path: string
  name: string
  branch: string
}>

export type ActionsScope = Readonly<{
  /** Environment identity id — the same id Hub selections and Viewer tabs carry. */
  environmentId: string
  /** Shell environment-group id; null is This device. Browser connections use local ids. */
  groupId: string | null
  environmentName: string
  /** True when this Environment is the one this window's daemon serves. */
  current: boolean
  projectId: string
  projectName: string
  worktrees: readonly ActionsWorktree[]
}>

export type ActionsScopes = Readonly<{
  /** The Project the Hub selection names, or null when nothing is selected. */
  selected: ActionsScope | null
  /** Equivalent Projects on other live Environments that answered this Hub's sessions. */
  siblings: readonly ActionsScope[]
}>

/** The Project id the selection names — the key every Actions read and write uses. */
export function useSelectedProjectId(): string | null {
  return useHubSelectionStore((s) => (s.selection.kind === 'home' ? null : s.selection.projectId))
}

export function useActionsScopes(): ActionsScopes {
  const inventories = useHubInventories()
  const selection = useHubSelectionStore((s) => s.selection)
  if (selection.kind === 'home') return { selected: null, siblings: [] }

  const source = inventories.find(
    (entry) => entry.inventory.environment.id === selection.environmentId,
  )
  const project = source?.inventory.projects.find((entry) => entry.id === selection.projectId)
  if (source === undefined || project === undefined) return { selected: null, siblings: [] }

  const toScope = (
    entry: (typeof inventories)[number],
    match: (typeof entry.inventory.projects)[number],
  ): ActionsScope => ({
    environmentId: entry.inventory.environment.id,
    groupId: entry.environmentId,
    environmentName: entry.inventory.environment.name,
    current: entry.current,
    projectId: match.id,
    projectName: match.name,
    worktrees: match.worktrees.map((worktree) => ({
      id: worktree.id,
      path: worktree.path,
      name: worktree.name,
      branch: worktree.branch,
    })),
  })

  const siblings = inventories.flatMap((entry) => {
    if (entry.inventory.environment.id === selection.environmentId) return []
    const twin = entry.inventory.projects.find(
      (candidate) => candidate.groupingKey === project.groupingKey,
    )
    return twin === undefined ? [] : [toScope(entry, twin)]
  })

  return { selected: toScope(source, project), siblings }
}

/**
 * Saved commands for one Project on an Environment this window's daemon does NOT
 * serve. Only the Electron shell can reach another Environment's daemon, so this
 * query exists only when the Hub actually found the Project on more than one
 * machine; browser sessions read sibling Projects directly through their own clients.
 */
export function useSiblingActions(scope: ActionsScope | null): readonly ActionView[] {
  const owner = scope === null ? null : environmentSessionFor(scope.environmentId)
  const query = useQuery({
    enabled: scope !== null && (isBrowser ? owner !== null : true),
    staleTime: 30_000,
    queryKey: ['shell', 'projectActions', scope?.groupId ?? null, scope?.projectId ?? ''],
    queryFn: async (): Promise<readonly ActionView[]> => {
      if (scope === null) return []
      if (isBrowser) return owner?.client.actions.query({ projectId: scope.projectId }) ?? []
      return shellTrpcClient.projectActions.query({
        groupId: scope.groupId,
        projectId: scope.projectId,
      })
    },
  })
  return query.data ?? []
}
