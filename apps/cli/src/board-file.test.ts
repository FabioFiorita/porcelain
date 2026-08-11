import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
  updateCard,
} from './board-file'

const root = join(tmpdir(), 'porcelain-board-file-test')
const repo = join(root, 'repo')

function boardJsonPath(): string {
  return join(repo, '.porcelain', 'board.json')
}

function readRaw(): unknown {
  return JSON.parse(readFileSync(boardJsonPath(), 'utf8'))
}

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
    expect(describeBoard(repo, [])).toContain('is empty')
  })

  it('groups cards by column with id, title, and body', () => {
    const text = describeBoard(repo, [
      {
        id: '00000000-0000-4000-8000-000000000001',
        title: 'Add login',
        status: 'todo',
        order: 1,
        createdAt: 1,
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        title: 'Fix retry',
        body: 'unbounded',
        status: 'doing',
        order: 2,
        createdAt: 2,
      },
    ])
    expect(text).toContain('## To do (1)')
    expect(text).toContain('## Doing (1)')
    expect(text).toContain('Add login')
    expect(text).toContain('Fix retry')
    expect(text).toContain('unbounded')
  })
})

describe('board-file v1 round-trip', () => {
  beforeEach(() => {
    rmSync(root, { recursive: true, force: true })
    mkdirSync(repo, { recursive: true })
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('creates, updates, moves, and deletes a card as strict v1 JSON', () => {
    const card = createCard(repo, 'Add login', undefined, 'todo')
    expect(readCards(repo)).toHaveLength(1)

    const raw = readRaw() as { version: number; cards: unknown[] }
    expect(raw.version).toBe(1)
    expect(Array.isArray(raw.cards)).toBe(true)
    expect(raw.cards).toHaveLength(1)

    expect(updateCard(repo, card.id, { title: 'Login flow', body: 'detail' })).toBe(true)
    expect(moveCard(repo, card.id, 'done')).toBe(true)
    expect(readCards(repo)[0]?.status).toBe('done')
    expect(deleteCard(repo, card.id)).toBe(true)
    expect(readCards(repo)).toEqual([])
  })

  it('returns false moving or deleting an unknown id', () => {
    expect(moveCard(repo, '00000000-0000-4000-8000-000000000099', 'done')).toBe(false)
    expect(deleteCard(repo, '00000000-0000-4000-8000-000000000099')).toBe(false)
  })

  it('rejects a legacy top-level array clearly', () => {
    mkdirSync(join(repo, '.porcelain'), { recursive: true })
    writeFileSync(boardJsonPath(), JSON.stringify([{ id: 'x', title: 'old' }]))
    expect(() => readCards(repo)).toThrow(/version 1|top-level arrays/)
  })
})
