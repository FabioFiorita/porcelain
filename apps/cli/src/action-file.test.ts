import { mkdirSync, readFileSync, rmSync } from 'node:fs'
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

const root = join(tmpdir(), 'porcelain-action-file-test')
const repo = join(root, 'repo')

describe('describeActions', () => {
  it('explains an empty list', () => {
    expect(describeActions(repo, [])).toContain('No saved actions')
  })

  it('lists each action with id, command, and where', () => {
    const text = describeActions(repo, [
      { id: 'a1', title: 'Storybook', command: 'pnpm storybook', order: 1, createdAt: 1 },
      {
        id: 'a2',
        title: 'iOS',
        command: 'xcodebuild',
        where: 'local',
        order: 2,
        createdAt: 2,
      },
    ])
    expect(text).toContain('[a1] Storybook')
    expect(text).toContain('$ pnpm storybook')
    expect(text).toContain('[a2] iOS')
    expect(text).toContain('where: local')
  })
})

describe('action-file round-trip', () => {
  beforeEach(() => {
    rmSync(root, { recursive: true, force: true })
    mkdirSync(repo, { recursive: true })
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('creates, updates, and deletes an action as a strict v1 document', () => {
    const action = createAction(repo, 'Storybook', 'pnpm storybook', undefined)
    expect(readActions(repo)).toHaveLength(1)
    const raw = JSON.parse(readFileSync(join(repo, '.porcelain', 'actions.json'), 'utf8')) as {
      version: number
      actions: unknown[]
    }
    expect(raw.version).toBe(1)
    expect(Array.isArray(raw.actions)).toBe(true)
    expect(updateAction(repo, action.id, { command: 'pnpm sb' })).toBe(true)
    expect(readActions(repo)[0]?.command).toBe('pnpm sb')
    expect(deleteAction(repo, action.id)).toBe(true)
    expect(readActions(repo)).toEqual([])
  })

  it('persists where: local and clears it back to primary', () => {
    const action = createAction(repo, 'iOS', 'xcodebuild', 'local')
    expect(readActions(repo)[0]?.where).toBe('local')
    expect(updateAction(repo, action.id, { where: 'primary' })).toBe(true)
    expect(readActions(repo)[0]?.where).toBeUndefined()
  })

  it('returns false updating or deleting an unknown id', () => {
    expect(updateAction(repo, 'nope', { title: 'x' })).toBe(false)
    expect(deleteAction(repo, 'nope')).toBe(false)
  })
})
