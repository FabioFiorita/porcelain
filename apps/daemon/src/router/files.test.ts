// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'

// Residual Search router only — host-fs procedures live under features/files.
const { git, scope } = vi.hoisted(() => ({
  git: {
    gitGrep: vi.fn(async () => [{ path: 'src/alpha.ts', line: 3, text: 'const needle = true' }]),
    gitSearchCode: vi.fn(async () => ({
      files: [
        {
          path: 'src/alpha.ts',
          hunks: [{ lines: [{ line: 3, text: 'const needle = true', match: true }] }],
          matchCount: 1,
        },
      ],
      truncated: false,
    })),
    gitListSearchFiles: vi.fn(async () => ['src/alpha.ts']),
  },
  scope: { hiddenPathsForRepo: vi.fn(async () => new Set<string>()) },
}))

vi.mock('../git/git', () => git)
vi.mock('../stores/scope-store', () => scope)

import { createFilesRouter } from './files'

const filesRouter = createFilesRouter()

const REQUEST_ID = '00000000-0000-4000-8000-000000000099'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' }, requestId: REQUEST_ID } as const

function caller() {
  return filesRouter.createCaller(PUBLIC_CONTEXT)
}

async function callWithRawInput(path: string, type: 'query' | 'mutation', input: unknown) {
  return await callTRPCProcedure({
    router: filesRouter,
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

afterEach(() => {
  vi.clearAllMocks()
})

describe('residual files Search router', () => {
  it('returns contract-valid text and code search results', async () => {
    expect(await caller().searchText({ repoPath: '/synthetic/repo', query: 'needle' })).toEqual([
      { path: 'src/alpha.ts', line: 3, text: 'const needle = true' },
    ])
    expect(
      await caller().searchCode({
        repoPath: '/synthetic/repo',
        query: 'needle',
        regex: false,
        caseSensitive: true,
        include: 'src/**/*.ts',
        exclude: 'src/generated/**',
      }),
    ).toEqual({
      files: [
        {
          path: 'src/alpha.ts',
          hunks: [{ lines: [{ line: 3, text: 'const needle = true', match: true }] }],
          matchCount: 1,
        },
      ],
      truncated: false,
    })
    expect(git.gitSearchCode).toHaveBeenCalledWith('/synthetic/repo', {
      query: 'needle',
      regex: false,
      caseSensitive: true,
      include: 'src/**/*.ts',
      exclude: 'src/generated/**',
    })
  })

  it('ranks file search hits and short-circuits a blank query', async () => {
    expect(await caller().searchFiles({ repoPath: '/synthetic/repo', query: 'alpha' })).toEqual([
      { path: 'src/alpha.ts', kind: 'file' },
    ])
    expect(await caller().searchFiles({ repoPath: '/synthetic/repo', query: '   ' })).toEqual([])
    expect(git.gitListSearchFiles).toHaveBeenCalledTimes(1)
  })

  it('rejects an unknown code-search key without shelling out to Git', async () => {
    const error = await rejected(() =>
      callWithRawInput('searchCode', 'query', {
        repoPath: '/synthetic/repo',
        query: 'needle',
        regex: false,
        caseSensitive: false,
        include: '',
        exclude: '',
        maxResults: 20,
      }),
    )
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'request.invalid',
      requestId: REQUEST_ID,
    })
    expect(git.gitSearchCode).not.toHaveBeenCalled()
  })

  it('rejects an empty text-search query as request.invalid', async () => {
    const error = await rejected(() =>
      callWithRawInput('searchText', 'query', { repoPath: '/synthetic/repo', query: '' }),
    )
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'request.invalid',
      requestId: REQUEST_ID,
    })
    expect(git.gitGrep).not.toHaveBeenCalled()
  })

  it('refuses to serialize a text-search result that violates its output contract', async () => {
    git.gitGrep.mockResolvedValueOnce([
      { path: 'src/alpha.ts', line: '3', text: 'const needle = true' },
    ] as never)

    const error = await rejected(() =>
      caller().searchText({ repoPath: '/synthetic/repo', query: 'needle' }),
    )
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(true)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'internal.unexpected',
      requestId: REQUEST_ID,
    })
  })
})
