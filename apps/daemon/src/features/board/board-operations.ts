import { randomUUID } from 'node:crypto'
import type { SessionChange } from '@porcelain/contracts/session'
import type { BoardChanges, BoardClock, BoardIds, BoardStore } from './board-capabilities'
import { createBoardChangesPublisher } from './board-notifications'
import { createClearBoardColumn } from './clear-board-column'
import { createCreateBoardCard } from './create-board-card'
import { createDeleteBoardCard } from './delete-board-card'
import { createJsonBoardStore } from './json-board-store'
import { createListBoardCards } from './list-board-cards'
import { createMoveBoardCard } from './move-board-card'
import { createUpdateBoardCard } from './update-board-card'

export type BoardOperations = {
  listBoardCards: ReturnType<typeof createListBoardCards>
  createBoardCard: ReturnType<typeof createCreateBoardCard>
  updateBoardCard: ReturnType<typeof createUpdateBoardCard>
  moveBoardCard: ReturnType<typeof createMoveBoardCard>
  deleteBoardCard: ReturnType<typeof createDeleteBoardCard>
  clearBoardColumn: ReturnType<typeof createClearBoardColumn>
}

export function createBoardOperations(options: {
  store?: BoardStore
  clock?: BoardClock
  ids?: BoardIds
  changes?: BoardChanges
  publishSessionChange?: (change: SessionChange) => void
}): BoardOperations {
  const store = options.store ?? createJsonBoardStore()
  const clock = options.clock ?? { now: () => Date.now() }
  const ids = options.ids ?? { create: () => randomUUID() }
  const changes =
    options.changes ??
    createBoardChangesPublisher(options.publishSessionChange ?? (() => undefined))

  return Object.freeze({
    listBoardCards: createListBoardCards({ store }),
    createBoardCard: createCreateBoardCard({ store, clock, ids, changes }),
    updateBoardCard: createUpdateBoardCard({ store, changes }),
    moveBoardCard: createMoveBoardCard({ store, clock, changes }),
    deleteBoardCard: createDeleteBoardCard({ store, changes }),
    clearBoardColumn: createClearBoardColumn({ store, changes }),
  })
}
