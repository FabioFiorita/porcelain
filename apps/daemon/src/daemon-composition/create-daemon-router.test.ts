// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { procedureCatalog } from '@porcelain/contracts'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { addCard, readCards } from '../stores/board-store'

// terminal-manager pulls node-pty (Electron ABI); mock before composition imports it.
vi.mock('../terminal/terminal-manager', () => ({
  listTerminals: () => [],
  renameTerminal: vi.fn(),
  createTerminal: vi.fn(() => 'term-1'),
  attachTerminal: vi.fn(() => ({ scrollback: '', status: 'running' as const })),
  detachTerminal: vi.fn(),
  detachSender: vi.fn(),
  killTerminal: vi.fn(),
  writeTerminal: vi.fn(),
  resizeTerminal: vi.fn(),
}))

// Companion home migration is not under test; keep project-board I/O on the temp fixture.
vi.mock('../project/migrate-home', () => ({
  ensureProjectCompanion: vi.fn(async () => undefined),
}))

import { createDaemonRouter } from './create-daemon-router'
import { createDaemonOperations } from './daemon-operations'

const REQUEST_ID = '00000000-0000-4000-8000-000000000001'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }

/** Complete flat procedure key set locked from the live composed router. */
const EXPECTED_PROCEDURE_KEYS = Object.keys(procedureCatalog).sort()

describe('createDaemonRouter composition', () => {
  let root = ''
  let repo = ''

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'porcelain-daemon-composition-'))
    repo = join(root, 'repo')
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('exposes the complete flat procedure key set from a single composition root', () => {
    const operations = createDaemonOperations()
    expect(Object.isFrozen(operations)).toBe(true)
    expect(operations).toEqual({})

    const router = createDaemonRouter({ operations })
    const keys = Object.keys(router._def.procedures).sort()

    expect(keys).toEqual(EXPECTED_PROCEDURE_KEYS)
    expect(keys).toHaveLength(EXPECTED_PROCEDURE_KEYS.length)
  })

  it('calls boardCards through the composed router against a temporary project board', async () => {
    const router = createDaemonRouter({ operations: createDaemonOperations() })
    const caller = router.createCaller(PUBLIC_CONTEXT)

    expect(await caller.boardCards(repo)).toEqual([])

    const created = await addCard(repo, { title: 'Composition seam card' })
    const cards = await caller.boardCards(repo)

    expect(cards).toEqual([created])
    expect(await readCards(repo)).toEqual([created])
  })
})
