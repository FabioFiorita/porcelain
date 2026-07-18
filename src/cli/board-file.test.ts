import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createCard,
  deleteCard,
  describeBoard,
  moveCard,
  normalizeStatus,
  readCards,
} from './board-file'

describe('normalizeStatus', () => {
  it('accepts the three columns', () => {
    expect(normalizeStatus('todo')).toBe('todo')
    expect(normalizeStatus('doing')).toBe('doing')
    expect(normalizeStatus('done')).toBe('done')
  })
  it('rejects anything else', () => {
    expect(normalizeStatus('backlog')).toBeNull()
    expect(normalizeStatus(undefined)).toBeNull()
    expect(normalizeStatus(5)).toBeNull()
  })
})

describe('describeBoard', () => {
  it('explains an empty board', () => {
    expect(describeBoard('/repo', [])).toContain('is empty')
  })

  it('groups cards by column with id, title, and body', () => {
    const text = describeBoard('/repo', [
      { id: 'c1', title: 'Add login', status: 'todo', order: 1, createdAt: 1 },
      { id: 'c2', title: 'Fix retry', body: 'unbounded', status: 'doing', order: 2, createdAt: 2 },
    ])
    expect(text).toContain('## To do (1)')
    expect(text).toContain('## Doing (1)')
    expect(text).toContain('[c1] Add login')
    expect(text).toContain('[c2] Fix retry')
    expect(text).toContain('unbounded')
  })
})

describe('board-file round-trip', () => {
  const dir = join(tmpdir(), 'porcelain-board-file-test')
  const file = join(dir, 'board.json')
  beforeEach(() => {
    process.env.PORCELAIN_BOARD = file
    rmSync(dir, { recursive: true, force: true })
  })
  afterEach(() => {
    delete process.env.PORCELAIN_BOARD
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates, moves, and deletes a card', () => {
    const card = createCard('/repo', 'Add login', undefined, 'todo')
    expect(readCards('/repo')).toHaveLength(1)
    expect(moveCard('/repo', card.id, 'done')).toBe(true)
    expect(readCards('/repo')[0]?.status).toBe('done')
    expect(deleteCard('/repo', card.id)).toBe(true)
    expect(readCards('/repo')).toEqual([])
  })

  it('returns false moving or deleting an unknown id', () => {
    expect(moveCard('/repo', 'nope', 'done')).toBe(false)
    expect(deleteCard('/repo', 'nope')).toBe(false)
  })
})
