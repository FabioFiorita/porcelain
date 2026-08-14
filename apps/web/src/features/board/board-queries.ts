import type { BoardCard } from '@porcelain/contracts/board'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { useQuery } from '@tanstack/react-query'
import { boardCardsKeyForProject } from './board-query-key'

/**
 * Board cards read adapter (BRD-004).
 *
 * Binds BRD-003 `boardCardsQuery` + daemon identity to React Query and invokes the
 * BRD-001 `listBoardCards` procedure through the Web tRPC client. Unloaded, empty,
 * and failed Board reads remain distinguishable.
 */

export type BoardCardsView = {
  /** Cards for the active Project. Empty only after a successful empty load. */
  readonly cards: BoardCard[]
  /** Non-null when the Board read failed (distinct from unloaded and empty). */
  readonly error: string | null
  /**
   * False while no Project is selected, the query is disabled, or the first
   * settlement has not arrived. True after success or failure.
   */
  readonly isLoaded: boolean
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message
  return 'Could not load the board'
}

/** All board cards for the current Project (live-refreshed via Board notifications). */
export function useBoardCards(): BoardCardsView {
  const projectPath = useHubRepoPath()
  const daemon = useDaemonIdentity()
  const daemonScope: DaemonScope = { host: daemon.host, version: daemon.version }
  const utils = trpc.useUtils()

  const query = useQuery({
    queryKey: projectPath
      ? boardCardsKeyForProject(daemonScope, projectPath)
      : ([{ domain: 'board', name: 'cards', projectPath: '' }, daemonScope] as const),
    queryFn: async (): Promise<BoardCard[]> => {
      if (projectPath === null) return []
      return utils.client.listBoardCards.query(projectPath)
    },
    enabled: projectPath !== null,
  })

  if (projectPath === null) {
    return { cards: [], error: null, isLoaded: false }
  }

  if (query.isError) {
    return {
      cards: [],
      error: readErrorMessage(query.error),
      isLoaded: true,
    }
  }

  if (query.isPending || query.data === undefined) {
    return { cards: [], error: null, isLoaded: false }
  }

  return { cards: query.data, error: null, isLoaded: true }
}
