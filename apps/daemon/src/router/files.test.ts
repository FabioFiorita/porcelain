// @vitest-environment node
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'

// Files mutations run against a temporary tree, so the filesystem behaviour they own stays real.
// Trash, Git search, and the repo scope store are the seams this suite must not touch: nothing
// here moves a file into the host trash, shells out to Git, or reads a scope file.
const { git, scope, trash } = vi.hoisted(() => ({
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
  trash: { moveToTrash: vi.fn(async () => undefined) },
}))

vi.mock('../git/git', () => git)
vi.mock('../stores/scope-store', () => scope)
vi.mock('../fs/move-to-trash', () => trash)

import { createFilesRouter } from './files'

const filesRouter = createFilesRouter()

const REQUEST_ID = '00000000-0000-4000-8000-000000000099'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' }, requestId: REQUEST_ID } as const
const directories: string[] = []

function caller() {
  return filesRouter.createCaller(PUBLIC_CONTEXT)
}

/** Deliver raw untrusted input the typed caller cannot express — the wire's own entry point. */
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

async function tempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-files-router-'))
  directories.push(directory)
  return directory
}

afterEach(async () => {
  vi.clearAllMocks()
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

describe('files router expected failures', () => {
  it('maps an existing rename destination to state.conflict without overwriting it', async () => {
    const directory = await tempDirectory()
    const from = join(directory, 'from.txt')
    const to = join(directory, 'to.txt')
    await writeFile(from, 'source')
    await writeFile(to, 'destination')

    const error = await rejected(() => caller().renamePath({ from, to }))
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'state.conflict',
      requestId: REQUEST_ID,
    })
    expect(await readFile(to, 'utf8')).toBe('destination')
    expect(existsSync(from)).toBe(true)
  })
})

describe('files router contract boundary', () => {
  it('returns a text file view for a readable UTF-8 file', async () => {
    const directory = await tempDirectory()
    const path = join(directory, 'notes.txt')
    await writeFile(path, 'line one\n', 'utf8')

    expect(await caller().readFile(path)).toEqual({ type: 'text', content: 'line one\n' })
  })

  it('returns the not-found file view for a path that vanished', async () => {
    const directory = await tempDirectory()

    expect(await caller().readFile(join(directory, 'missing.txt'))).toEqual({ type: 'not-found' })
  })

  it('returns inlined preview HTML and null for a missing preview target', async () => {
    const directory = await tempDirectory()
    const path = join(directory, 'index.html')
    await writeFile(path, '<!doctype html><p>preview</p>', 'utf8')

    expect(await caller().previewHtml(path)).toContain('<p>preview</p>')
    expect(await caller().previewHtml(join(directory, 'missing.html'))).toBeNull()
  })

  it('serializes file mutations as void and string results against the real tree', async () => {
    const directory = await tempDirectory()
    const written = join(directory, 'written.txt')
    const created = join(directory, 'created.txt')
    const folder = join(directory, 'folder')

    expect(await caller().writeTextFile({ path: written, content: 'héllo\n' })).toBeUndefined()
    expect(await readFile(written, 'utf8')).toBe('héllo\n')
    expect(await caller().createFile({ path: created })).toBeUndefined()
    expect(await readFile(created, 'utf8')).toBe('')
    expect(await caller().createFolder({ path: folder })).toBeUndefined()
    expect((await stat(folder)).isDirectory()).toBe(true)
    expect(await caller().duplicatePath({ path: written })).toBe(
      join(directory, 'written copy.txt'),
    )
    expect(await readFile(join(directory, 'written copy.txt'), 'utf8')).toBe('héllo\n')
  })

  it('renames to a free destination and serializes the mutation as void', async () => {
    const directory = await tempDirectory()
    const from = join(directory, 'from.txt')
    const to = join(directory, 'to.txt')
    await writeFile(from, 'source', 'utf8')

    expect(await caller().renamePath({ from, to })).toBeUndefined()
    expect(existsSync(from)).toBe(false)
    expect(await readFile(to, 'utf8')).toBe('source')
  })

  it('serializes a trash mutation as void after delegating to the trash helper', async () => {
    const directory = await tempDirectory()
    const path = join(directory, 'old.txt')
    await writeFile(path, 'old', 'utf8')

    expect(await caller().trashPath(path)).toBeUndefined()
    expect(trash.moveToTrash).toHaveBeenCalledWith(path)
  })

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

  it('rejects an unknown write key as request.invalid without writing the file', async () => {
    const directory = await tempDirectory()
    const path = join(directory, 'rejected.txt')

    const error = await rejected(() =>
      callWithRawInput('writeTextFile', 'mutation', {
        path,
        content: 'body',
        encoding: 'utf8',
      }),
    )
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'request.invalid',
      requestId: REQUEST_ID,
    })
    expect(existsSync(path)).toBe(false)
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

  it('rejects a non-string trash input as request.invalid without trashing anything', async () => {
    const error = await rejected(() =>
      callWithRawInput('trashPath', 'mutation', { path: '/synthetic/repo/old.md' }),
    )
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'request.invalid',
      requestId: REQUEST_ID,
    })
    expect(trash.moveToTrash).not.toHaveBeenCalled()
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
