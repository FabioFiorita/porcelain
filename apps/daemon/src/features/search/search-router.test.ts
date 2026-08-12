// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import type {
  SearchCodeInput,
  SearchCodeOutput,
  SearchFilesInput,
  SearchFilesOutput,
  SearchTextInput,
  SearchTextOutput,
} from '@porcelain/contracts/search'
import { callTRPCProcedure } from '@trpc/server'
import { describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../../daemon-composition/public-error'
import type { SearchOperations } from './search-operations'
import { createSearchRouter } from './search-router'

const REQUEST_ID = '00000000-0000-4000-8000-000000000099'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }

const textOutput: SearchTextOutput = [{ path: 'src/alpha.ts', line: 3, text: 'needle' }]
const codeOutput: SearchCodeOutput = {
  files: [
    {
      path: 'src/alpha.ts',
      hunks: [{ lines: [{ line: 3, text: 'needle', match: true }] }],
      matchCount: 1,
    },
  ],
  truncated: false,
}
const filesOutput: SearchFilesOutput = [{ path: 'src', kind: 'dir' }]

function stubOperations(overrides: Partial<SearchOperations> = {}): SearchOperations {
  return {
    searchText: vi.fn(async () => textOutput),
    searchCode: vi.fn(async () => codeOutput),
    searchFiles: vi.fn(async () => filesOutput),
    ...overrides,
  }
}

async function callWithRawInput(
  router: ReturnType<typeof createSearchRouter>,
  path: string,
  input: unknown,
): Promise<unknown> {
  return await callTRPCProcedure({
    router,
    path,
    type: 'query',
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

describe('Search router', () => {
  it('exposes exactly the three flat Search query procedures', () => {
    const router = createSearchRouter(stubOperations())

    expect(Object.keys(router._def.procedures).sort()).toEqual([
      'searchCode',
      'searchFiles',
      'searchText',
    ])
  })

  it('maps valid contract inputs to one operation each', async () => {
    const searchText = vi.fn(async (input: SearchTextInput) => {
      expect(input).toEqual({ repoPath: '/repo', query: 'needle' })
      return textOutput
    })
    const searchCode = vi.fn(async (input: SearchCodeInput) => {
      expect(input).toEqual({
        repoPath: '/repo',
        query: 'needle',
        regex: true,
        caseSensitive: false,
        include: 'src/**/*.ts',
        exclude: 'src/generated/**',
      })
      return codeOutput
    })
    const searchFiles = vi.fn(async (input: SearchFilesInput) => {
      expect(input).toEqual({ repoPath: '/repo', query: 'src' })
      return filesOutput
    })
    const router = createSearchRouter(stubOperations({ searchText, searchCode, searchFiles }))
    const caller = router.createCaller(PUBLIC_CONTEXT)

    await expect(caller.searchText({ repoPath: '/repo', query: 'needle' })).resolves.toEqual(
      textOutput,
    )
    await expect(
      caller.searchCode({
        repoPath: '/repo',
        query: 'needle',
        regex: true,
        caseSensitive: false,
        include: 'src/**/*.ts',
        exclude: 'src/generated/**',
      }),
    ).resolves.toEqual(codeOutput)
    await expect(caller.searchFiles({ repoPath: '/repo', query: 'src' })).resolves.toEqual(
      filesOutput,
    )
    expect(searchText).toHaveBeenCalledTimes(1)
    expect(searchCode).toHaveBeenCalledTimes(1)
    expect(searchFiles).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid input before invoking an operation', async () => {
    const searchCode = vi.fn(async () => codeOutput)
    const router = createSearchRouter(stubOperations({ searchCode }))
    const error = await rejected(() =>
      callWithRawInput(router, 'searchCode', {
        repoPath: '/repo',
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
    expect(searchCode).not.toHaveBeenCalled()
  })

  it('rejects malformed operation output through the internal boundary', async () => {
    const searchText = vi.fn(
      async () => [{ path: 'src/alpha.ts', line: '3', text: 'needle' }] as never,
    )
    const router = createSearchRouter(stubOperations({ searchText }))
    const error = await rejected(() =>
      router.createCaller(PUBLIC_CONTEXT).searchText({ repoPath: '/repo', query: 'needle' }),
    )
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(true)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'internal.unexpected',
      requestId: REQUEST_ID,
    })
  })

  it('does not translate an unexpected operation exception into a Search failure', async () => {
    const failure = new Error('native Git details')
    const searchText = vi.fn(async () => {
      throw failure
    })
    const router = createSearchRouter(stubOperations({ searchText }))
    const error = await rejected(() =>
      router.createCaller(PUBLIC_CONTEXT).searchText({ repoPath: '/repo', query: 'needle' }),
    )
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(true)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'internal.unexpected',
      requestId: REQUEST_ID,
    })
  })
})
