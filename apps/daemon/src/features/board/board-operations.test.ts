// @vitest-environment node
import { type BoardFileV1, emptyBoardFileV1 } from '@porcelain/shared/board-file'
import { describe, expect, it } from 'vitest'
import type {
  BoardChanges,
  BoardStore,
  BoardStoreResult,
  BoardTransactResult,
} from './board-capabilities'
import { createBoardOperations } from './board-operations'

const PROJECT = '/synthetic/repo'
const ID_A = '00000000-0000-4000-8000-0000000000a1'

function memoryStore(initial: BoardFileV1 = emptyBoardFileV1()): {
  store: BoardStore
  files: Map<string, BoardFileV1>
  reads: number
  writes: number
} {
  const files = new Map<string, BoardFileV1>([[PROJECT, initial]])
  let reads = 0
  let writes = 0

  const store: BoardStore = {
    async read(projectPath) {
      reads += 1
      const file = files.get(projectPath) ?? emptyBoardFileV1()
      return { ok: true, value: structuredClone(file) }
    },
    async transact(projectPath, change) {
      reads += 1
      const current = files.get(projectPath) ?? emptyBoardFileV1()
      const planned = change(structuredClone(current))
      if (!planned.ok) return planned
      writes += 1
      files.set(projectPath, structuredClone(planned.value.file))
      return planned
    },
  }

  return {
    store,
    files,
    get reads() {
      return reads
    },
    get writes() {
      return writes
    },
  }
}

function recordingChanges(): { changes: BoardChanges; events: string[] } {
  const events: string[] = []
  return {
    events,
    changes: {
      publish(change) {
        events.push(`${change.type}:${change.projectPath}`)
      },
    },
  }
}

describe('board operations', () => {
  it('lists, creates, updates, moves, deletes, and clears with one notification per durable write', async () => {
    const mem = memoryStore()
    const { changes, events } = recordingChanges()
    let tick = 100
    let n = 0
    const ops = createBoardOperations({
      store: mem.store,
      clock: {
        now: () => {
          tick += 1
          return tick
        },
      },
      ids: {
        create: () => {
          n += 1
          return `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`
        },
      },
      changes,
    })

    expect(await ops.listBoardCards({ projectPath: PROJECT })).toEqual({
      ok: true,
      value: [],
    })
    expect(events).toEqual([])

    const created = await ops.createBoardCard({
      projectPath: PROJECT,
      title: '  Ship  ',
      body: 'notes',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.value).toMatchObject({
      title: 'Ship',
      body: 'notes',
      status: 'todo',
    })
    expect(events).toEqual([`board.changed:${PROJECT}`])

    const updated = await ops.updateBoardCard({
      projectPath: PROJECT,
      cardId: created.value.id,
      title: 'Ship it',
    })
    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    expect(updated.value.title).toBe('Ship it')

    const moved = await ops.moveBoardCard({
      projectPath: PROJECT,
      cardId: created.value.id,
      status: 'done',
    })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.value.status).toBe('done')

    const cleared = await ops.clearBoardColumn({ projectPath: PROJECT, status: 'done' })
    expect(cleared.ok).toBe(true)
    if (!cleared.ok) return
    expect(cleared.value.cardIds).toEqual([created.value.id])

    const again = await ops.createBoardCard({ projectPath: PROJECT, title: 'Temp' })
    if (!again.ok) return
    const deleted = await ops.deleteBoardCard({
      projectPath: PROJECT,
      cardId: again.value.id,
    })
    expect(deleted).toEqual({ ok: true, value: { cardId: again.value.id } })

    // create, update, move, clear, create-again, delete
    expect(events).toHaveLength(6)
    expect(await ops.listBoardCards({ projectPath: PROJECT })).toEqual({ ok: true, value: [] })
  })

  it('rejects invalid title and missing cards without writing or notifying', async () => {
    const mem = memoryStore()
    const { changes, events } = recordingChanges()
    const ops = createBoardOperations({
      store: mem.store,
      clock: { now: () => 1 },
      ids: { create: () => ID_A },
      changes,
    })

    const blank = await ops.createBoardCard({ projectPath: PROJECT, title: '   ' })
    expect(blank).toEqual({
      ok: false,
      error: { code: 'board.invalid-title', reason: 'blank', maxLength: 240 },
    })
    expect(mem.writes).toBe(0)
    expect(events).toEqual([])

    const missingUpdate = await ops.updateBoardCard({
      projectPath: PROJECT,
      cardId: ID_A,
      title: 'x',
    })
    expect(missingUpdate).toEqual({
      ok: false,
      error: { code: 'board.card-not-found', cardId: ID_A },
    })
    expect(await ops.moveBoardCard({ projectPath: PROJECT, cardId: ID_A, status: 'done' })).toEqual(
      {
        ok: false,
        error: { code: 'board.card-not-found', cardId: ID_A },
      },
    )
    expect(await ops.deleteBoardCard({ projectPath: PROJECT, cardId: ID_A })).toEqual({
      ok: false,
      error: { code: 'board.card-not-found', cardId: ID_A },
    })
    expect(mem.writes).toBe(0)
    expect(events).toEqual([])
  })

  it('surfaces adapter unavailable and never notifies on store failure', async () => {
    const { changes, events } = recordingChanges()
    const store: BoardStore = {
      async read(): Promise<BoardStoreResult<BoardFileV1>> {
        return { ok: false, error: { code: 'board.unavailable' } }
      },
      async transact(): Promise<BoardTransactResult> {
        return { ok: false, error: { code: 'board.unavailable' } }
      },
    }
    const ops = createBoardOperations({
      store,
      clock: { now: () => 1 },
      ids: { create: () => ID_A },
      changes,
    })

    expect(await ops.listBoardCards({ projectPath: PROJECT })).toEqual({
      ok: false,
      error: { code: 'board.unavailable' },
    })
    expect(await ops.createBoardCard({ projectPath: PROJECT, title: 'x' })).toEqual({
      ok: false,
      error: { code: 'board.unavailable' },
    })
    expect(events).toEqual([])
  })

  it('empty clear succeeds with no card ids and still notifies once', async () => {
    const mem = memoryStore()
    const { changes, events } = recordingChanges()
    const ops = createBoardOperations({ store: mem.store, changes })
    const cleared = await ops.clearBoardColumn({ projectPath: PROJECT, status: 'todo' })
    expect(cleared).toEqual({
      ok: true,
      value: { status: 'todo', cardIds: [] },
    })
    expect(events).toEqual([`board.changed:${PROJECT}`])
  })
})
