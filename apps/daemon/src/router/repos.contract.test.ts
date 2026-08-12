// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'

const { scope } = vi.hoisted(() => ({
  scope: {
    hiddenPathsForRepo: vi.fn(async () => new Set<string>()),
    pinnedPathsForRepo: vi.fn(async () => [] as string[]),
    hidePath: vi.fn(async () => undefined),
    unhidePath: vi.fn(async () => undefined),
    pinPath: vi.fn(async () => undefined),
    unpinPath: vi.fn(async () => undefined),
  },
}))

vi.mock('../stores/scope-store', () => scope)

import { createReposRouter } from './repos'

const reposRouter = createReposRouter()

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

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'porcelain-repos-contract-'))
  checkout = join(root, 'alpha')
  await mkdir(join(checkout, 'src'), { recursive: true })
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
})
