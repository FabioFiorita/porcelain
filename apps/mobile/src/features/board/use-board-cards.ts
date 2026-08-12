import { boardCardsQuery } from '@porcelain/client-runtime/board'
import type { BoardCard } from '@porcelain/contracts/board'
import { boardProcedures } from '@porcelain/contracts/board'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useActiveProject } from '@/features/projects'
import { useShellStore } from '@/features/shell/shell-store'
import { useIsTablet } from '@/features/shell/use-app-window'
import { getDaemonClient } from '@/lib/daemon/client'
import { isPaired } from '@/lib/daemon/environment'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { DaemonError, daemonErrorMessage } from '@/lib/daemon/errors'
import { callDaemon, namedContractProcedure } from '@/lib/daemon/procedure'

import { boardCardsQueryKey } from './board-query-key'
import { useBoardStore } from './board-store'

/**
 * Board read + presentation hooks that reach the daemon (BRD-005).
 * Public surface re-exports through `board-data.ts`.
 */

export type BoardCards = {
  cards: BoardCard[]
  error: Error | null
  /** True only until the first read lands — a board that has loaded empty is not loading. */
  isLoading: boolean
}

const listBoardCardsProcedure = namedContractProcedure(
  'listBoardCards',
  boardProcedures.listBoardCards,
)

/**
 * Every card on the open project's board.
 *
 * No poll, by design: the daemon pushes a `board.changed` session signal whenever a card is
 * written — whether by this client, the desktop, or the agent through the CLI — and the
 * BoardNotificationBridge turns that into an exact invalidation.
 */
export function useBoardCards(active: boolean): BoardCards {
  const project = useActiveProject()
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? 'none'
  const projectPath = project?.path ?? null
  const enabled = active && project !== null && isPaired(environment)

  const query = useQuery({
    enabled,
    queryKey: projectPath
      ? boardCardsQueryKey(environmentId, projectPath)
      : (['daemon', environmentId, boardCardsQuery('')] as const),
    queryFn: async (): Promise<BoardCard[]> => {
      if (projectPath === null || !isPaired(environment)) return []
      return callDaemon(getDaemonClient(environment), listBoardCardsProcedure, projectPath)
    },
  })

  if (!enabled) {
    return { cards: [], error: null, isLoading: false }
  }

  if (query.isError) {
    const error =
      query.error instanceof Error
        ? query.error
        : new Error(query.error != null ? String(query.error) : 'Could not load the board')
    return { cards: [], error, isLoading: false }
  }

  return {
    cards: query.data ?? [],
    error: null,
    isLoading: query.isPending || query.data === undefined,
  }
}

/**
 * Every board write is a daemon round trip that can fail — a project that moved, a card the agent
 * deleted first. Report it on the panel that triggered it rather than letting a tap look like
 * it worked.
 */
export function useBoardFailure(): {
  failure: string | null
  guard: (label: string, run: () => Promise<void>) => void
} {
  const [failure, setFailure] = useState<string | null>(null)

  return {
    failure,
    guard: (label, run) => {
      setFailure(null)
      run().catch((cause: unknown) => {
        const detail =
          cause instanceof DaemonError
            ? daemonErrorMessage(cause)
            : cause instanceof Error
              ? cause.message
              : String(cause)
        setFailure(`${label}: ${detail}`)
      })
    },
  }
}

/**
 * Focus a card from any board panel.
 *
 * On tablet the Focus rail is already on screen beside the board, so a tap is just a selection.
 * On phone the companion is a sheet, so the tap that focuses a card also opens the sheet that
 * shows it — otherwise the selection would have no visible effect at all.
 */
export function useFocusCard(): (card: BoardCard) => void {
  const project = useActiveProject()
  const select = useBoardStore((state) => state.select)
  const isTablet = useIsTablet()
  const openSheet = useShellStore((state) => state.openSheet)
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)

  return (card: BoardCard): void => {
    if (project === null) return
    select(project.path, card.id)
    if (isTablet) return
    setActiveSurface('board')
    openSheet('companion')
  }
}

/** The focused card id for the open project, or `null` when the Focus rail is on its default. */
export function useSelectedCardId(): string | null {
  const project = useActiveProject()
  const focus = useBoardStore((state) => state.focus)
  if (focus === null || project === null) return null
  return focus.repoPath === project.path ? focus.cardId : null
}

/** Active Project path for Board focus resolution — kept inside the feature boundary. */
export function useBoardProjectPath(): string | null {
  return useActiveProject()?.path ?? null
}
