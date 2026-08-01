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
    expect(action.where).toBeUndefined()
    const actions = await readActions('/repo')
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ id: action.id, title: 'Storybook' })
  })

  it('keeps where: local when set', async () => {
    const action = await addAction('/repo', {
      title: 'iOS',
      command: 'xcodebuild',
      where: 'local',
    })
    expect(action.where).toBe('local')
    expect((await readActions('/repo'))[0]?.where).toBe('local')
  })

  it('omits where when primary (the default)', async () => {
    const action = await addAction('/repo', {
      title: 'Dev',
      command: 'pnpm dev',
      where: 'primary',
    })
    expect(action.where).toBeUndefined()
  })

  it('updates title, command, and where', async () => {
    const { id } = await addAction('/repo', { title: 'old', command: 'echo old' })
    await updateAction('/repo', id, { title: 'new', command: 'echo new', where: 'local' })
    expect((await readActions('/repo'))[0]).toMatchObject({
      title: 'new',
      command: 'echo new',
      where: 'local',
    })
  })

  it('clears where back to primary by dropping the field', async () => {
    const { id } = await addAction('/repo', { title: 'x', command: 'y', where: 'local' })
    await updateAction('/repo', id, { where: 'primary' })
    expect((await readActions('/repo'))[0]?.where).toBeUndefined()
  })

  it('strips unknown fields (e.g. retired cwd) on read', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      file,
      JSON.stringify({
        '/repo': [
          {
            id: 'x',
            title: 'Dev',
            command: 'pnpm dev',
            cwd: 'apps/web',
            order: 1,
            createdAt: 1,
          },
        ],
      }),
    )
    const action = (await readActions('/repo'))[0]
    expect(action?.title).toBe('Dev')
    expect(action).not.toHaveProperty('cwd')
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
