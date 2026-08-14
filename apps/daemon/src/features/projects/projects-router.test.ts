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
  browseProjectDirectories: vi.fn<ProjectsOperations['browseProjectDirectories']>(async () => ({
    ok: true as const,
    value: BROWSE,
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
  it('binds all four procedures to the catalog and returns strict outputs', async () => {
    expect(await caller().openRepoPath('/projects/alpha')).toEqual(PROJECT)
    expect(await caller().recentRepos()).toEqual([PROJECT])
    expect(await caller().removeRecentRepo('/projects/old')).toBeUndefined()
    expect(await caller().browseDirs(null)).toEqual(BROWSE)
    expect(Object.keys(procedureCatalog)).toContain('openRepoPath')
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
