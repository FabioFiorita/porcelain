import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addCard, clearCards, deleteCard, moveCard, readCards, updateCard } from './board-store'

const dir = join(tmpdir(), 'porcelain-board-store-test')
const file = join(dir, 'board.json')

beforeEach(() => {
  process.env.PORCELAIN_BOARD = file
  rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_BOARD
  rmSync(dir, { recursive: true, force: true })
})

describe('board-store CRUD', () => {
  it('adds a card (default todo) and reads it back', async () => {
    const card = await addCard('/repo', { title: 'Add login' })
    expect(card.status).toBe('todo')
    const cards = await readCards('/repo')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ id: card.id, title: 'Add login', status: 'todo' })
  })

  it('honours a requested status and an optional body', async () => {
    const card = await addCard('/repo', { title: 'Fix retry', body: 'unbounded', status: 'doing' })
    expect(card).toMatchObject({ status: 'doing', body: 'unbounded' })
  })

  it('updates a card title and body', async () => {
    const { id } = await addCard('/repo', { title: 'old' })
    await updateCard('/repo', id, { title: 'new', body: 'details' })
    expect((await readCards('/repo'))[0]).toMatchObject({ title: 'new', body: 'details' })
  })

  it('moves a card to another column', async () => {
    const { id } = await addCard('/repo', { title: 'Add login' })
    await moveCard('/repo', id, 'done')
    expect((await readCards('/repo'))[0]?.status).toBe('done')
  })

  it('deletes a card', async () => {
    const { id } = await addCard('/repo', { title: 'Add login' })
    await deleteCard('/repo', id)
    expect(await readCards('/repo')).toEqual([])
  })

  it('clears every card in a column, leaving the others', async () => {
    await addCard('/repo', { title: 'still todo' })
    await addCard('/repo', { title: 'done a', status: 'done' })
    await addCard('/repo', { title: 'done b', status: 'done' })
    await clearCards('/repo', 'done')
    expect((await readCards('/repo')).map((c) => c.title)).toEqual(['still todo'])
  })

  it('keeps repos isolated', async () => {
    await addCard('/r1', { title: 'one' })
    await addCard('/r2', { title: 'two' })
    expect(await readCards('/r1')).toHaveLength(1)
    expect((await readCards('/r2'))[0]?.title).toBe('two')
  })

  it('reads cards sorted by order', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      file,
      JSON.stringify({
        '/repo': [
          { id: 'c', title: 'third', status: 'todo', order: 3, createdAt: 3 },
          { id: 'a', title: 'first', status: 'todo', order: 1, createdAt: 1 },
          { id: 'b', title: 'second', status: 'todo', order: 2, createdAt: 2 },
        ],
      }),
    )
    expect((await readCards('/repo')).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })
})
