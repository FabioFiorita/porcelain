import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createAction,
  deleteAction,
  describeActions,
  readActions,
  updateAction,
} from './action-file'

describe('describeActions', () => {
  it('explains an empty list', () => {
    expect(describeActions('/repo', [])).toContain('No saved actions')
  })

  it('lists each action with id, command, and cwd', () => {
    const text = describeActions('/repo', [
      { id: 'a1', title: 'Storybook', command: 'pnpm storybook', order: 1, createdAt: 1 },
      { id: 'a2', title: 'Dev', command: 'pnpm dev', cwd: 'apps/web', order: 2, createdAt: 2 },
    ])
    expect(text).toContain('[a1] Storybook')
    expect(text).toContain('$ pnpm storybook')
    expect(text).toContain('[a2] Dev')
    expect(text).toContain('cwd: apps/web')
  })
})

describe('action-file round-trip', () => {
  const dir = join(tmpdir(), 'porcelain-action-file-test')
  const file = join(dir, 'actions.json')
  beforeEach(() => {
    process.env.PORCELAIN_ACTIONS = file
    rmSync(dir, { recursive: true, force: true })
  })
  afterEach(() => {
    delete process.env.PORCELAIN_ACTIONS
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates, updates, and deletes an action', () => {
    const action = createAction('/repo', 'Storybook', 'pnpm storybook', undefined)
    expect(readActions('/repo')).toHaveLength(1)
    expect(updateAction('/repo', action.id, { command: 'pnpm sb' })).toBe(true)
    expect(readActions('/repo')[0]?.command).toBe('pnpm sb')
    expect(deleteAction('/repo', action.id)).toBe(true)
    expect(readActions('/repo')).toEqual([])
  })

  it('returns false updating or deleting an unknown id', () => {
    expect(updateAction('/repo', 'nope', { title: 'x' })).toBe(false)
    expect(deleteAction('/repo', 'nope')).toBe(false)
  })
})
