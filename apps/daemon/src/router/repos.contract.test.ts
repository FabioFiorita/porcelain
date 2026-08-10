// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'

// The Projects and Files procedures in repos.ts read the persisted daemon config, the repo scope
// store, Git worktree state, and start companion migration/watch side effects. This suite owns the
// contract boundary only, so each of those seams is test-owned: nothing here reads the human's
// config, writes a scope file, shells out to Git, or starts a watcher. Directory contents come from
// a temporary tree created per run.
const { browse, config, companion, linkedWorktree, scope, watch } = vi.hoisted(() => ({
  browse: {
    browseDirs: vi.fn(async () => ({
      path: '/synthetic/projects',
      parent: '/synthetic',
      entries: [{ name: 'alpha', path: '/synthetic/projects/alpha', isRepo: true }],
    })),
  },
  config: {
    loadConfig: vi.fn(async () => ({ recentRepos: [] as string[] })),
    updateConfig: vi.fn(async () => undefined),
  },
  companion: { ensureProjectCompanion: vi.fn(async () => undefined) },
  linkedWorktree: { isLinkedWorktree: vi.fn(async () => false) },
  scope: {
    hiddenPathsForRepo: vi.fn(async () => new Set<string>()),
    pinnedPathsForRepo: vi.fn(async () => [] as string[]),
    hidePath: vi.fn(async () => undefined),
    unhidePath: vi.fn(async () => undefined),
    pinPath: vi.fn(async () => undefined),
    unpinPath: vi.fn(async () => undefined),
  },
  watch: { watchProjectCompanion: vi.fn(() => undefined) },
}))

vi.mock('../git/browse', () => browse)
vi.mock('../git/git', () => ({ warmFileList: vi.fn(() => undefined) }))
vi.mock('../git/linked-worktree', () => linkedWorktree)
vi.mock('../project/migrate-home', () => companion)
vi.mock('../review/review-watch', () => watch)
vi.mock('../stores/config-store', () => config)
vi.mock('../stores/scope-store', () => scope)

import { reposRouter } from './repos'

const REQUEST_ID = '00000000-0000-4000-8000-000000000077'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' }, requestId: REQUEST_ID } as const

function caller() {
  return reposRouter.createCaller(PUBLIC_CONTEXT)
}

/** Deliver raw untrusted input the typed caller cannot express — the wire's own entry point. */
async function callWithRawInput(path: string, type: 'query' | 'mutation', input: unknown) {
  return await callTRPCProcedure({
    router: reposRouter,
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

let root = ''
let checkout = ''
let worktree = ''

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'porcelain-repos-contract-'))
  checkout = join(root, 'alpha')
  worktree = join(root, 'beta-worktree')
  await mkdir(join(checkout, 'src'), { recursive: true })
  await mkdir(worktree, { recursive: true })
  await writeFile(join(checkout, 'readme.md'), '# alpha\n', 'utf8')
  await writeFile(join(checkout, '.DS_Store'), '', 'utf8')
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('repos router contract boundary', () => {
  it('drops linked worktrees when recent repositories are requested without input', async () => {
    config.loadConfig.mockResolvedValueOnce({ recentRepos: [checkout, worktree] })
    linkedWorktree.isLinkedWorktree.mockImplementation(async (path: string) => path === worktree)

    expect(await caller().recentRepos()).toEqual([{ path: checkout, name: 'alpha' }])
  })

  it('keeps linked worktrees when the caller opts in', async () => {
    config.loadConfig.mockResolvedValueOnce({ recentRepos: [checkout, worktree] })
    linkedWorktree.isLinkedWorktree.mockImplementation(async (path: string) => path === worktree)

    expect(await caller().recentRepos({ includeWorktrees: true })).toEqual([
      { path: checkout, name: 'alpha' },
      { path: worktree, name: 'beta-worktree' },
    ])
  })

  it('rejects an unknown recent-repositories key as request.invalid', async () => {
    const error = await rejected(() =>
      callWithRawInput('recentRepos', 'query', { includeWorktrees: true, includeHidden: true }),
    )
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'request.invalid',
      requestId: REQUEST_ID,
    })
    expect(config.loadConfig).not.toHaveBeenCalled()
  })

  it('rejects an unknown hide-path key without touching the scope store', async () => {
    const error = await rejected(() =>
      callWithRawInput('hidePath', 'mutation', {
        repoPath: checkout,
        path: join(checkout, 'src'),
        recursive: true,
      }),
    )
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'request.invalid',
      requestId: REQUEST_ID,
    })
    expect(scope.hidePath).not.toHaveBeenCalled()
  })

  it('returns contract-valid directory entries with directories first', async () => {
    scope.pinnedPathsForRepo.mockResolvedValueOnce([join(checkout, 'src')])

    expect(
      await caller().readDir({ repoPath: checkout, path: checkout, showHidden: false }),
    ).toEqual([
      { name: 'src', path: join(checkout, 'src'), kind: 'dir', hidden: false, pinned: true },
      {
        name: 'readme.md',
        path: join(checkout, 'readme.md'),
        kind: 'file',
        hidden: false,
        pinned: false,
      },
    ])
  })

  it('serializes a pin mutation as void after writing the scope store', async () => {
    expect(
      await caller().pinPath({ repoPath: checkout, path: join(checkout, 'src') }),
    ).toBeUndefined()
    expect(scope.pinPath).toHaveBeenCalledWith(checkout, join(checkout, 'src'))
  })

  it('opens a repository path and runs its companion and watch effects', async () => {
    expect(await caller().openRepoPath(checkout)).toEqual({ path: checkout, name: 'alpha' })
    expect(config.updateConfig).toHaveBeenCalledTimes(1)
    expect(companion.ensureProjectCompanion).toHaveBeenCalledWith(checkout)
    expect(watch.watchProjectCompanion).toHaveBeenCalledWith(checkout)
  })

  it('refuses to serialize a browse result that violates its output contract', async () => {
    browse.browseDirs.mockResolvedValueOnce({
      path: '/synthetic/projects',
      parent: '/synthetic',
      entries: [{ name: 'alpha', path: '/synthetic/projects/alpha', isRepo: 'yes' }],
    } as never)

    const error = await rejected(() => caller().browseDirs(null))
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(true)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'internal.unexpected',
      requestId: REQUEST_ID,
    })
  })
})
