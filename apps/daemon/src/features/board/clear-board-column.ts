import { planClearBoardColumn } from '@porcelain/shared/board-file'
import type {
  BoardChanges,
  BoardOperationResult,
  BoardStatus,
  BoardStore,
} from './board-capabilities'

export type ClearBoardColumnInput = {
  projectPath: string
  status: BoardStatus
}

export function createClearBoardColumn(deps: { store: BoardStore; changes: BoardChanges }) {
  return async function clearBoardColumn(
    input: ClearBoardColumnInput,
  ): Promise<BoardOperationResult<{ status: BoardStatus; cardIds: string[] }>> {
    const result = await deps.store.transact(input.projectPath, (current) => {
      const planned = planClearBoardColumn(current, { status: input.status })
      return {
        ok: true,
        value: {
          kind: 'clear',
          file: planned.file,
          status: planned.status,
          cardIds: planned.cardIds,
        },
      }
    })

    if (!result.ok) return result
    if (result.value.kind !== 'clear') {
      return { ok: false, error: { code: 'board.unavailable' } }
    }

    deps.changes.publish({ type: 'board.changed', projectPath: input.projectPath })
    return {
      ok: true,
      value: { status: result.value.status, cardIds: result.value.cardIds },
    }
  }
}

export type ClearBoardColumn = ReturnType<typeof createClearBoardColumn>
