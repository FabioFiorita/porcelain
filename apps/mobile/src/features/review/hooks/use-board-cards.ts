import type { UseQueryResult } from '@tanstack/react-query'
import { useIsFocused } from 'expo-router'

import type { DaemonError } from '@/lib/daemon/errors'
import {
  addBoardCardMutation,
  type BoardCard,
  boardCardsQuery,
  type CardStatus,
  clearBoardCardsMutation,
  deleteBoardCardMutation,
  moveBoardCardMutation,
  updateBoardCardMutation,
} from '@/lib/daemon/procedures/review'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

type BoardCardsQuery = UseQueryResult<BoardCard[], DaemonError>

export function useBoardCards(): BoardCardsQuery {
  const repo = useActiveRepo()
  const focused = useIsFocused()
  return useDaemonQuery(boardCardsQuery, repo?.path ?? '', {
    enabled: repo !== null && focused,
  })
}

export function useBoardCardActions(): {
  add(title: string, body: string, status: CardStatus): Promise<void>
  update(id: string, title: string, body: string): Promise<void>
  move(id: string, status: CardStatus): Promise<void>
  remove(id: string): Promise<void>
  clear(status: CardStatus): Promise<void>
} {
  const repo = useActiveRepo()
  const addMutation = useDaemonMutation(addBoardCardMutation, { invalidates: ['boardCards'] })
  const updateMutation = useDaemonMutation(updateBoardCardMutation, { invalidates: ['boardCards'] })
  const moveMutation = useDaemonMutation(moveBoardCardMutation, { invalidates: ['boardCards'] })
  const deleteMutation = useDaemonMutation(deleteBoardCardMutation, { invalidates: ['boardCards'] })
  const clearMutation = useDaemonMutation(clearBoardCardsMutation, { invalidates: ['boardCards'] })

  return {
    add: async (title: string, body: string, status: CardStatus): Promise<void> => {
      if (repo === null) return
      await addMutation.mutateAsync({
        ...(body.trim() === '' ? {} : { body }),
        repoPath: repo.path,
        status,
        title,
      })
    },
    clear: async (status: CardStatus): Promise<void> => {
      if (repo === null) return
      await clearMutation.mutateAsync({ repoPath: repo.path, status })
    },
    move: async (id: string, status: CardStatus): Promise<void> => {
      if (repo === null) return
      await moveMutation.mutateAsync({ id, repoPath: repo.path, status })
    },
    remove: async (id: string): Promise<void> => {
      if (repo === null) return
      await deleteMutation.mutateAsync({ id, repoPath: repo.path })
    },
    update: async (id: string, title: string, body: string): Promise<void> => {
      if (repo === null) return
      await updateMutation.mutateAsync({
        ...(body.trim() === '' ? {} : { body }),
        body: body.trim() === '' ? '' : body,
        id,
        repoPath: repo.path,
        title,
      })
    },
  }
}
