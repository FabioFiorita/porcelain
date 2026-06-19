import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addAction, deleteAction, moveAction, readActions, updateAction } from './actions-store'

const dir = join(tmpdir(), 'porcelain-actions-store-test')
const file = join(dir, 'actions.json')

beforeEach(() => {
  process.env.PORCELAIN_ACTIONS = file
  rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_ACTIONS
  rmSync(dir, { recursive: true, force: true })
})

describe('actions-store CRUD', () => {
  it('adds an action and reads it back', async () => {
    const action = await addAction('/repo', { title: 'Storybook', command: 'pnpm storybook' })
    expect(action).toMatchObject({ title: 'Storybook', command: 'pnpm storybook' })
    const actions = await readActions('/repo')
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ id: action.id, title: 'Storybook' })
  })

  it('keeps an optional cwd', async () => {
    const action = await addAction('/repo', { title: 'Dev', command: 'pnpm dev', cwd: 'apps/web' })
    expect(action.cwd).toBe('apps/web')
  })

  it('updates title, command, and cwd', async () => {
    const { id } = await addAction('/repo', { title: 'old', command: 'echo old' })
    await updateAction('/repo', id, { title: 'new', command: 'echo new', cwd: 'sub' })
    expect((await readActions('/repo'))[0]).toMatchObject({
      title: 'new',
      command: 'echo new',
      cwd: 'sub',
    })
  })

  it('clears cwd when updated to an empty string', async () => {
    const { id } = await addAction('/repo', { title: 'x', command: 'y', cwd: 'sub' })
    await updateAction('/repo', id, { cwd: '' })
    expect((await readActions('/repo'))[0]?.cwd).toBeUndefined()
  })

  it('deletes an action', async () => {
    const { id } = await addAction('/repo', { title: 'Storybook', command: 'pnpm storybook' })
    await deleteAction('/repo', id)
    expect(await readActions('/repo')).toEqual([])
  })

  it('keeps repos isolated', async () => {
    await addAction('/r1', { title: 'one', command: 'a' })
    await addAction('/r2', { title: 'two', command: 'b' })
    expect(await readActions('/r1')).toHaveLength(1)
    expect((await readActions('/r2'))[0]?.title).toBe('two')
  })

  it('reads actions sorted by order', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      file,
      JSON.stringify({
        '/repo': [
          { id: 'c', title: 'third', command: 'c', order: 3, createdAt: 3 },
          { id: 'a', title: 'first', command: 'a', order: 1, createdAt: 1 },
          { id: 'b', title: 'second', command: 'b', order: 2, createdAt: 2 },
        ],
      }),
    )
    expect((await readActions('/repo')).map((a) => a.id)).toEqual(['a', 'b', 'c'])
  })

  it('moves an action up and down by swapping order', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      file,
      JSON.stringify({
        '/repo': [
          { id: 'a', title: 'first', command: 'a', order: 1, createdAt: 1 },
          { id: 'b', title: 'second', command: 'b', order: 2, createdAt: 2 },
          { id: 'c', title: 'third', command: 'c', order: 3, createdAt: 3 },
        ],
      }),
    )
    await moveAction('/repo', 'c', 'up')
    expect((await readActions('/repo')).map((a) => a.id)).toEqual(['a', 'c', 'b'])
    await moveAction('/repo', 'c', 'down')
    expect((await readActions('/repo')).map((a) => a.id)).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op when moving past the ends', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      file,
      JSON.stringify({
        '/repo': [
          { id: 'a', title: 'first', command: 'a', order: 1, createdAt: 1 },
          { id: 'b', title: 'second', command: 'b', order: 2, createdAt: 2 },
        ],
      }),
    )
    await moveAction('/repo', 'a', 'up')
    await moveAction('/repo', 'b', 'down')
    expect((await readActions('/repo')).map((a) => a.id)).toEqual(['a', 'b'])
  })
})
