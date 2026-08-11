import { planMoveBoardCard } from '@porcelain/shared/board-file'
import type {
  BoardCard,
  BoardChanges,
  BoardClock,
  BoardOperationResult,
  BoardStatus,
  BoardStore,
} from './board-capabilities'

export type MoveBoardCardInput = {
  projectPath: string
  cardId: string
  status: BoardStatus
}

export function createMoveBoardCard(deps: {
  store: BoardStore
  clock: BoardClock
  changes: BoardChanges
}) {
  return async function moveBoardCard(
    input: MoveBoardCardInput,
  ): Promise<BoardOperationResult<BoardCard>> {
    const order = deps.clock.now()
    const result = await deps.store.transact(input.projectPath, (current) => {
      const planned = planMoveBoardCard(current, {
        cardId: input.cardId,
        status: input.status,
        order,
      })
      if (!planned.ok) return planned
      return { ok: true, value: { kind: 'move', file: planned.file, card: planned.card } }
    })

    if (!result.ok) return result
    if (result.value.kind !== 'move') {
      return { ok: false, error: { code: 'board.unavailable' } }
    }

    deps.changes.publish({ type: 'board.changed', projectPath: input.projectPath })
    return { ok: true, value: result.value.card }
  }
}

export type MoveBoardCard = ReturnType<typeof createMoveBoardCard>
