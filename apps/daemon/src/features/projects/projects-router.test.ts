// @vitest-environment node
import { procedureCatalog, publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../../daemon-composition/public-error'
import type { ProjectsOperations } from './projects-operations'
import { createProjectsRouter } from './projects-router'

const REQUEST_ID = '00000000-0000-4000-8000-000000000077'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }
const PROJECT = { path: '/projects/alpha', name: 'alpha' }
const BROWSE = { path: '/projects', parent: '/', entries: [] }
const CANVAS_RECORD = {
  id: 'canvas-1',
  worktreeId: 'wt-1',
  title: 'Intent',
  kind: 'html' as const,
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:00.000Z',
  tracked: false,
}

const TRACKED_RECORD = { ...CANVAS_RECORD, worktreeId: null, tracked: true }
const OVERRIDES = { hiddenPaths: ['apps/legacy'], pinnedPaths: [], worktrees: {} }

const operations = {
  openProject: vi.fn<ProjectsOperations['openProject']>(async () => ({
    ok: true as const,
    value: PROJECT,
  })),
  listRecentProjects: vi.fn<ProjectsOperations['listRecentProjects']>(async () => ({
    ok: true as const,
    value: [PROJECT],
  })),
  removeRecentProject: vi.fn<ProjectsOperations['removeRecentProject']>(async () => ({
    ok: true as const,
    value: undefined,
  })),
  removeHubProject: vi.fn<ProjectsOperations['removeHubProject']>(async () => ({
    ok: true as const,
    value: undefined,
  })),
  removeHubWorktree: vi.fn<ProjectsOperations['removeHubWorktree']>(async () => ({
    ok: true as const,
    value: undefined,
  })),
  browseProjectDirectories: vi.fn<ProjectsOperations['browseProjectDirectories']>(async () => ({
    ok: true as const,
    value: BROWSE,
  })),
  listHubInventory: vi.fn<ProjectsOperations['listHubInventory']>(async () => ({
    ok: true as const,
    value: {
      environment: {
        id: 'env-1',
        name: 'synthetic',
        host: 'synthetic',
        platform: 'linux',
        arch: 'x64',
      },
      projects: [],
    },
  })),
  createHubWorktree: vi.fn<ProjectsOperations['createHubWorktree']>(async () => ({
    ok: true as const,
    value: {
      id: 'wt-1',
      projectId: 'proj-1',
      path: '/projects/alpha-worktrees/topic',
      name: 'topic',
      branch: 'topic',
      isPrimary: false,
    },
  })),
  writeCanvas: vi.fn<ProjectsOperations['writeCanvas']>(async () => ({
    ok: false,
    error: { code: 'canvas.not-found' },
  })),
  listCanvases: vi.fn<ProjectsOperations['listCanvases']>(async () => ({
    ok: true as const,
    value: [CANVAS_RECORD],
  })),
  readCanvas: vi.fn<ProjectsOperations['readCanvas']>(async () => ({
    ok: true as const,
    value: { record: CANVAS_RECORD, content: '<p>hi</p>' },
  })),
  mintCanvasAccessToken: vi.fn<ProjectsOperations['mintCanvasAccessToken']>(async () => ({
    ok: true as const,
    value: { token: 'synthetic-token' },
  })),
  promoteCanvas: vi.fn<ProjectsOperations['promoteCanvas']>(async () => ({
    ok: true as const,
    value: { record: TRACKED_RECORD, bundlePath: '/projects/alpha/.porcelain/canvases/canvas-1' },
  })),
  promoteOverrides: vi.fn<ProjectsOperations['promoteOverrides']>(async () => ({
    ok: true as const,
    value: OVERRIDES,
  })),
  listOverlay: vi.fn<ProjectsOperations['listOverlay']>(async () => ({
    ok: true as const,
    value: {
      path: '/projects/alpha',
      present: true,
      canvases: [TRACKED_RECORD],
      overrides: OVERRIDES,
    },
  })),
} satisfies ProjectsOperations

const router = createProjectsRouter(operations)

function caller() {
  return router.createCaller(PUBLIC_CONTEXT)
}

async function callWithRawInput(path: string, type: 'query' | 'mutation', input: unknown) {
  return await callTRPCProcedure({
    router,
    path,
    type,
    ctx: PUBLIC_CONTEXT,
    getRawInput: async () => input,
    signal: undefined,
    batchIndex: 0,
  })
}

async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('Expected a tRPC rejection')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Projects router contract boundary', () => {
  it('binds every Projects procedure to the catalog and returns strict outputs', async () => {
    expect(await caller().openRepoPath('/projects/alpha')).toEqual(PROJECT)
    expect(await caller().recentRepos()).toEqual([PROJECT])
    expect(await caller().removeRecentRepo('/projects/old')).toBeUndefined()
    expect(await caller().removeHubProject('proj-1')).toBeUndefined()
    expect(
      await caller().removeHubWorktree({ projectId: 'proj-1', worktreeId: 'wt-1' }),
    ).toBeUndefined()
    expect(await caller().browseDirs(null)).toEqual(BROWSE)
    expect(await caller().hubInventory()).toEqual({
      environment: {
        id: 'env-1',
        name: 'synthetic',
        host: 'synthetic',
        platform: 'linux',
        arch: 'x64',
      },
      projects: [],
    })
    expect(await caller().createHubWorktree({ projectId: 'proj-1', branch: 'topic' })).toEqual({
      id: 'wt-1',
      projectId: 'proj-1',
      path: '/projects/alpha-worktrees/topic',
      name: 'topic',
      branch: 'topic',
      isPrimary: false,
    })
    expect(await caller().listCanvases({ projectId: 'proj-1' })).toEqual([CANVAS_RECORD])
    expect(await caller().readCanvas({ projectId: 'proj-1', canvasId: 'canvas-1' })).toEqual({
      record: CANVAS_RECORD,
      content: '<p>hi</p>',
    })
    expect(
      await caller().mintCanvasAccessToken({ projectId: 'proj-1', canvasId: 'canvas-1' }),
    ).toEqual({ token: 'synthetic-token' })
    expect(
      await caller().promoteCanvas({
        projectId: 'proj-1',
        canvasId: 'canvas-1',
        path: '/projects/alpha',
      }),
    ).toEqual({
      record: TRACKED_RECORD,
      bundlePath: '/projects/alpha/.porcelain/canvases/canvas-1',
    })
    expect(
      await caller().promoteOverrides({ projectId: 'proj-1', path: '/projects/alpha' }),
    ).toEqual(OVERRIDES)
    expect(await caller().listOverlay({ path: '/projects/alpha' })).toEqual({
      path: '/projects/alpha',
      present: true,
      canvases: [TRACKED_RECORD],
      overrides: OVERRIDES,
    })
    expect(Object.keys(procedureCatalog)).toContain('hubInventory')
  })

  it('rejects unknown wire input before invoking the operation', async () => {
    const error = await rejected(() =>
      callWithRawInput('recentRepos', 'query', { includeWorktrees: true, extra: true }),
    )
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'request.invalid',
      requestId: REQUEST_ID,
    })
    expect(operations.listRecentProjects).not.toHaveBeenCalled()
  })

  it.each([
    ['openRepoPath', 'openProject', 'projects.not-found', () => caller().openRepoPath('/missing')],
    [
      'openRepoPath',
      'openProject',
      'projects.dev-repo-forbidden',
      () => caller().openRepoPath('/home/fabiofiorita/code/porcelain'),
    ],
    ['recentRepos', 'listRecentProjects', 'projects.unavailable', () => caller().recentRepos()],
    [
      'removeRecentRepo',
      'removeRecentProject',
      'projects.unavailable',
      () => caller().removeRecentRepo('/old'),
    ],
    [
      'browseDirs',
      'browseProjectDirectories',
      'projects.not-a-directory',
      () => caller().browseDirs('/file'),
    ],
    [
      'readCanvas',
      'readCanvas',
      'canvas.not-found',
      () => caller().readCanvas({ projectId: 'proj-1', canvasId: 'missing' }),
    ],
    [
      'promoteCanvas',
      'promoteCanvas',
      'projects.overlay-target-invalid',
      () =>
        caller().promoteCanvas({
          projectId: 'proj-1',
          canvasId: 'canvas-1',
          path: '/somewhere/else',
        }),
    ],
  ] as const)('maps %s operation failures to typed public errors', async (_procedure, operation, code, run) => {
    const method = operations[operation]
    method.mockResolvedValueOnce({ ok: false, error: { code } } as never)
    const error = await rejected(run)
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({ code, requestId: REQUEST_ID })
  })

  it('turns an operation output that violates the wire contract into an unexpected error', async () => {
    operations.openProject.mockResolvedValueOnce({
      ok: true,
      value: { path: '/projects/alpha', name: 42 },
    } as never)
    const error = await rejected(() => caller().openRepoPath('/projects/alpha'))
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(true)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'internal.unexpected',
      requestId: REQUEST_ID,
    })
  })
})
