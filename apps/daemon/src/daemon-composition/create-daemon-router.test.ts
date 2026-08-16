// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { procedureCatalog } from '@porcelain/contracts'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../project/git-exclude', () => ({
  ensureCompanionHidden: vi.fn(async () => undefined),
}))

import type { ProjectsOperations } from '../features/projects'
import { createTasksAttachments, createTasksStore } from '../features/tasks'
import type { TerminalOperations } from '../features/terminal'
import { createDaemonRouter } from './create-daemon-router'
import { createDaemonOperations } from './daemon-operations'

/** Complete flat procedure key set locked from the live composed router. */
const EXPECTED_PROCEDURE_KEYS = Object.keys(procedureCatalog).sort()

function terminalOperations(): TerminalOperations {
  return {
    create: () => ({ ok: true, value: 'term-1' }),
    createRetained: () => ({ ok: true, value: 'term-retained' }),
    devServers: {
      list: () => [],
      start: () => ({ ok: false, error: { code: 'terminal.dev-server-target' } }),
      stop: () => ({ ok: false, error: { code: 'terminal.dev-server-not-found' } }),
      dismiss: () => ({ ok: false, error: { code: 'terminal.dev-server-not-found' } }),
    },
    attach: () => ({ ok: false, error: { code: 'terminal.not-found' } }),
    detach: () => ({ ok: false, error: { code: 'terminal.not-found' } }),
    write: () => ({ ok: false, error: { code: 'terminal.not-found' } }),
    resize: () => ({ ok: false, error: { code: 'terminal.not-found' } }),
    kill: () => ({ ok: false, error: { code: 'terminal.not-found' } }),
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
    removeHubProject: async () => ({ ok: true, value: undefined }),
    removeHubWorktree: async () => ({ ok: true, value: undefined }),
    browseProjectDirectories: async () => ({ ok: false, error: { code: 'projects.unavailable' } }),
    listHubInventory: async () => ({ ok: false, error: { code: 'projects.unavailable' } }),
    createHubWorktree: async () => ({ ok: false, error: { code: 'projects.not-found' } }),
    listCanvases: async () => ({ ok: true, value: [] }),
    readCanvas: async () => ({ ok: false, error: { code: 'canvas.not-found' } }),
    mintCanvasAccessToken: async () => ({ ok: false, error: { code: 'canvas.not-found' } }),
    promoteCanvas: async () => ({ ok: false, error: { code: 'canvas.not-found' } }),
    promoteOverrides: async () => ({
      ok: false,
      error: { code: 'projects.overlay-target-invalid' },
    }),
    listOverlay: async () => ({
      ok: true,
      value: { path: '/projects/alpha', present: false, canvases: [], overrides: null },
    }),
  }
}

/** The four canonical Tasks names the eleventh domain contributes to the flat router. */
const TASKS_PROCEDURE_KEYS = ['listTasks', 'createTask', 'updateTask', 'deleteTask'] as const

describe('createDaemonRouter composition', () => {
  let root = ''
  let tasksHome = ''

  /** Daemon-root Tasks adapters over a temp home, the way `server.ts` resolves them. */
  function tasksAdapters() {
    return {
      store: createTasksStore({ homeDir: tasksHome }),
      attachments: createTasksAttachments({ homeDir: tasksHome }),
    }
  }

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'porcelain-daemon-composition-'))
    tasksHome = join(root, 'tasks-home')
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('exposes the complete flat procedure key set from a single composition root', () => {
    const operations = createDaemonOperations({
      publishSessionChange: () => undefined,
      projects: projectsOperations(),
      tasks: tasksAdapters(),
      terminal: terminalOperations(),
      homeDir: join(root, 'home'),
    })
    expect(Object.isFrozen(operations)).toBe(true)
    expect(operations.remote).toBeDefined()
    expect(operations.tasks).toBeDefined()
    expect(operations.actions).toBeDefined()
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
    for (const name of TASKS_PROCEDURE_KEYS) expect(keys).toContain(name)
  })

  it('supplies the operation catalog at construction rather than through a module mock', () => {
    const first = createDaemonOperations({
      publishSessionChange: () => undefined,
      projects: projectsOperations(),
      tasks: tasksAdapters(),
      terminal: terminalOperations(),
      homeDir: join(root, 'home'),
    })
    const second = createDaemonOperations({
      publishSessionChange: () => undefined,
      projects: projectsOperations(),
      tasks: tasksAdapters(),
      terminal: terminalOperations(),
      homeDir: join(root, 'home'),
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
