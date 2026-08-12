// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { procedureCatalog } from '@porcelain/contracts'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../project/git-exclude', () => ({
  ensureCompanionHidden: vi.fn(async () => undefined),
}))
vi.mock('../review/review-watch', () => ({
  watchProjectCompanion: vi.fn(),
}))

import type { ProjectsOperations } from '../features/projects'
import type { TerminalOperations } from '../features/terminal'
import { createDaemonRouter } from './create-daemon-router'
import { createDaemonOperations } from './daemon-operations'

const REQUEST_ID = '00000000-0000-4000-8000-000000000001'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }

/** Complete flat procedure key set locked from the live composed router. */
const EXPECTED_PROCEDURE_KEYS = Object.keys(procedureCatalog).sort()

function terminalOperations(): TerminalOperations {
  return {
    create: () => ({ ok: true, value: 'term-1' }),
    attach: () => ({ ok: false, error: { code: 'terminal.not-found' } }),
    detach: () => ({ ok: false, error: { code: 'terminal.not-found' } }),
    write: () => ({ ok: false, error: { code: 'terminal.not-found' } }),
    resize: () => ({ ok: false, error: { code: 'terminal.not-found' } }),
    kill: () => ({ ok: false, error: { code: 'terminal.not-found' } }),
    pasteImage: async () => ({ ok: false, error: { code: 'terminal.not-found' } }),
    pasteFile: async () => ({ ok: false, error: { code: 'terminal.not-found' } }),
    list: () => [],
    rename: () => undefined,
    detachSink: () => undefined,
    sweep: () => undefined,
  }
}

function projectsOperations(): ProjectsOperations {
  return {
    openProject: async () => ({ ok: false, error: { code: 'projects.not-found' } }),
    listRecentProjects: async () => ({ ok: true, value: [] }),
    removeRecentProject: async () => ({ ok: true, value: undefined }),
    browseProjectDirectories: async () => ({ ok: false, error: { code: 'projects.unavailable' } }),
  }
}

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
    const operations = createDaemonOperations({
      publishSessionChange: () => undefined,
      projects: projectsOperations(),
      terminal: terminalOperations(),
    })
    expect(Object.isFrozen(operations)).toBe(true)
    expect(operations.remote).toBeDefined()
    expect(operations.board).toBeDefined()
    expect(operations.actions).toBeDefined()
    expect(operations.reviewComments).toBeDefined()
    expect(operations.files).toBeDefined()
    expect(operations.git).toBeDefined()
    expect(operations.search).toBeDefined()
    expect(operations.projectData).toBeDefined()
    expect(operations.projects).toBeDefined()
    expect(operations.terminal).toBeDefined()

    const router = createDaemonRouter({ operations })
    const keys = Object.keys(router._def.procedures).sort()

    expect(keys).toEqual(EXPECTED_PROCEDURE_KEYS)
    expect(keys).toHaveLength(EXPECTED_PROCEDURE_KEYS.length)
  })

  it('calls listBoardCards through the composed router against a temporary project board', async () => {
    const operations = createDaemonOperations({
      publishSessionChange: () => undefined,
      projects: projectsOperations(),
      terminal: terminalOperations(),
    })
    const router = createDaemonRouter({ operations })
    const caller = router.createCaller(PUBLIC_CONTEXT)

    expect(await caller.listBoardCards(repo)).toEqual([])

    const created = await caller.createBoardCard({
      projectPath: repo,
      title: 'Composition seam card',
    })
    const cards = await caller.listBoardCards(repo)

    expect(cards).toEqual([created])
    expect(created.title).toBe('Composition seam card')
  })

  it('supplies the operation catalog at construction rather than through a module mock', () => {
    const first = createDaemonOperations({
      publishSessionChange: () => undefined,
      projects: projectsOperations(),
      terminal: terminalOperations(),
    })
    const second = createDaemonOperations({
      publishSessionChange: () => undefined,
      projects: projectsOperations(),
      terminal: terminalOperations(),
    })
    expect(first).not.toBe(second)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(second)).toBe(true)

    const routerA = createDaemonRouter({ operations: first })
    const routerB = createDaemonRouter({ operations: second })

    expect(Object.keys(routerA._def.procedures).sort()).toEqual(EXPECTED_PROCEDURE_KEYS)
    expect(Object.keys(routerB._def.procedures).sort()).toEqual(EXPECTED_PROCEDURE_KEYS)
  })
})
