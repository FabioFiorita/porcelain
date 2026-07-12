import type { BoardCard, CardStatus } from '@backend/board-store'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

/** The three columns, in order, with their display labels. */
export const BOARD_COLUMNS: { status: CardStatus; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'doing', label: 'Doing' },
  { status: 'done', label: 'Done' },
]

export const STATUS_LABEL: Record<CardStatus, string> = {
  todo: 'To do',
  doing: 'Doing',
  done: 'Done',
}

/** All board cards for the current repo (live-refreshed when the agent moves one). */
export function useBoardCards(): BoardCard[] {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.boardCards.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return data ?? []
}

export interface NewCardInput {
  title: string
  body?: string
  status?: CardStatus
}

/** Add/edit/move/delete board cards. Each mutation refreshes the board. */
export function useCardActions(): {
  add: (input: NewCardInput) => Promise<void>
  update: (id: string, fields: { title?: string; body?: string }) => Promise<void>
  move: (id: string, status: CardStatus) => Promise<void>
  remove: (id: string) => Promise<void>
  clear: (status: CardStatus) => Promise<void>
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const refresh = async (): Promise<void> => {
    await utils.boardCards.invalidate()
  }
  const add = trpc.addBoardCard.useMutation({
    onSuccess: refresh,
    onError: onMutationError('Add card'),
  })
  const update = trpc.updateBoardCard.useMutation({
    onSuccess: refresh,
    onError: onMutationError('Update card'),
  })
  const move = trpc.moveBoardCard.useMutation({
    onSuccess: refresh,
    onError: onMutationError('Move card'),
  })
  const remove = trpc.deleteBoardCard.useMutation({
    onSuccess: refresh,
    onError: onMutationError('Delete card'),
  })
  const clear = trpc.clearBoardCards.useMutation({
    onSuccess: refresh,
    onError: onMutationError('Clear cards'),
  })
  return {
    add: async (input) => {
      if (!repo) return
      await add.mutateAsync({ repoPath: repo.path, ...input })
    },
    update: async (id, fields) => {
      if (!repo) return
      await update.mutateAsync({ repoPath: repo.path, id, ...fields })
    },
    move: async (id, status) => {
      if (!repo) return
      await move.mutateAsync({ repoPath: repo.path, id, status })
    },
    remove: async (id) => {
      if (!repo) return
      await remove.mutateAsync({ repoPath: repo.path, id })
    },
    clear: async (status) => {
      if (!repo) return
      await clear.mutateAsync({ repoPath: repo.path, status })
    },
  }
}
