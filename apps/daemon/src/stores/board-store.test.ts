import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addCard, clearCards, deleteCard, moveCard, readCards, updateCard } from './board-store'

const root = join(tmpdir(), 'porcelain-board-store-test')
const repo = join(root, 'repo')

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('board-store CRUD', () => {
  it('adds a card (default todo) and reads it back', async () => {
    const card = await addCard(repo, { title: 'Add login' })
    expect(card.status).toBe('todo')
    const cards = await readCards(repo)
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ id: card.id, title: 'Add login', status: 'todo' })
  })

  it('honours a requested status and an optional body', async () => {
    const card = await addCard(repo, { title: 'Fix retry', body: 'unbounded', status: 'doing' })
    expect(card).toMatchObject({ status: 'doing', body: 'unbounded' })
  })

  it('updates a card title and body', async () => {
    const { id } = await addCard(repo, { title: 'old' })
    await updateCard(repo, id, { title: 'new', body: 'details' })
    expect((await readCards(repo))[0]).toMatchObject({ title: 'new', body: 'details' })
  })

  it('moves a card to another column', async () => {
    const { id } = await addCard(repo, { title: 'Add login' })
    await moveCard(repo, id, 'done')
    expect((await readCards(repo))[0]?.status).toBe('done')
  })

  it('deletes a card', async () => {
    const { id } = await addCard(repo, { title: 'x' })
    await deleteCard(repo, id)
    expect(await readCards(repo)).toEqual([])
  })

  it('clears a column', async () => {
    await addCard(repo, { title: 'a', status: 'done' })
    await addCard(repo, { title: 'b', status: 'todo' })
    await clearCards(repo, 'done')
    expect((await readCards(repo)).map((c) => c.title)).toEqual(['b'])
  })
})
