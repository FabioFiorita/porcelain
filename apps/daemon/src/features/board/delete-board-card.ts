import { planDeleteBoardCard } from '@porcelain/shared/board-file'
import type { BoardChanges, BoardOperationResult, BoardStore } from './board-capabilities'

export type DeleteBoardCardInput = {
  projectPath: string
  cardId: string
}

export function createDeleteBoardCard(deps: { store: BoardStore; changes: BoardChanges }) {
  return async function deleteBoardCard(
    input: DeleteBoardCardInput,
  ): Promise<BoardOperationResult<{ cardId: string }>> {
    const result = await deps.store.transact(input.projectPath, (current) => {
      const planned = planDeleteBoardCard(current, { cardId: input.cardId })
      if (!planned.ok) return planned
      return {
        ok: true,
        value: { kind: 'delete', file: planned.file, cardId: planned.cardId },
      }
    })

    if (!result.ok) return result
    if (result.value.kind !== 'delete') {
      return { ok: false, error: { code: 'board.unavailable' } }
    }

    deps.changes.publish({ type: 'board.changed', projectPath: input.projectPath })
    return { ok: true, value: { cardId: result.value.cardId } }
  }
}

export type DeleteBoardCard = ReturnType<typeof createDeleteBoardCard>
