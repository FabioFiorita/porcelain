import { planCreateBoardCard } from '@porcelain/shared/board-file'
import type {
  BoardCard,
  BoardChanges,
  BoardClock,
  BoardIds,
  BoardOperationResult,
  BoardStatus,
  BoardStore,
} from './board-capabilities'

export type CreateBoardCardInput = {
  projectPath: string
  title: string
  body?: string
  status?: BoardStatus
}

export function createCreateBoardCard(deps: {
  store: BoardStore
  clock: BoardClock
  ids: BoardIds
  changes: BoardChanges
}) {
  return async function createBoardCard(
    input: CreateBoardCardInput,
  ): Promise<BoardOperationResult<BoardCard>> {
    const now = deps.clock.now()
    const id = deps.ids.create()

    const result = await deps.store.transact(input.projectPath, (current) => {
      const planned = planCreateBoardCard(current, {
        id,
        title: input.title,
        body: input.body,
        status: input.status,
        order: now,
        createdAt: now,
      })
      if (!planned.ok) return planned
      return { ok: true, value: { kind: 'create', file: planned.file, card: planned.card } }
    })

    if (!result.ok) return result
    if (result.value.kind !== 'create') {
      return { ok: false, error: { code: 'board.unavailable' } }
    }

    deps.changes.publish({ type: 'board.changed', projectPath: input.projectPath })
    return { ok: true, value: result.value.card }
  }
}

export type CreateBoardCard = ReturnType<typeof createCreateBoardCard>
