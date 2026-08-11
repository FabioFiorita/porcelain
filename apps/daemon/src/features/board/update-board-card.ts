import { planUpdateBoardCard } from '@porcelain/shared/board-file'
import type {
  BoardCard,
  BoardChanges,
  BoardOperationResult,
  BoardStore,
} from './board-capabilities'

export type UpdateBoardCardInput = {
  projectPath: string
  cardId: string
  title?: string
  body?: string
}

export function createUpdateBoardCard(deps: { store: BoardStore; changes: BoardChanges }) {
  return async function updateBoardCard(
    input: UpdateBoardCardInput,
  ): Promise<BoardOperationResult<BoardCard>> {
    const result = await deps.store.transact(input.projectPath, (current) => {
      const planned = planUpdateBoardCard(current, {
        cardId: input.cardId,
        title: input.title,
        body: input.body,
      })
      if (!planned.ok) return planned
      return { ok: true, value: { kind: 'update', file: planned.file, card: planned.card } }
    })

    if (!result.ok) return result
    if (result.value.kind !== 'update') {
      return { ok: false, error: { code: 'board.unavailable' } }
    }

    deps.changes.publish({ type: 'board.changed', projectPath: input.projectPath })
    return { ok: true, value: result.value.card }
  }
}

export type UpdateBoardCard = ReturnType<typeof createUpdateBoardCard>
