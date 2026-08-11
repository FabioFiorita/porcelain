import { sortBoardCards } from '@porcelain/shared/board-file'
import type { BoardCard, BoardOperationResult, BoardStore } from './board-capabilities'

export type ListBoardCardsInput = { projectPath: string }

export function createListBoardCards(deps: { store: BoardStore }) {
  return async function listBoardCards(
    input: ListBoardCardsInput,
  ): Promise<BoardOperationResult<BoardCard[]>> {
    const read = await deps.store.read(input.projectPath)
    if (!read.ok) return read
    return { ok: true, value: sortBoardCards(read.value.cards) }
  }
}

export type ListBoardCards = ReturnType<typeof createListBoardCards>
