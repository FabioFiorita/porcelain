// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { normalizePublicError } from '../../daemon-composition/public-error'
import type { FilesOperations } from './files-operations'
import { createFilesFeatureRouter } from './files-router'

const REQUEST_ID = '00000000-0000-4000-8000-000000000099'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }
const PROJECT = '/synthetic/repo'

function expectPublicCode(error: unknown, code: string) {
  const normalized = normalizePublicError(error, REQUEST_ID)
  expect(normalized.unexpected).toBe(false)
  expect(publicErrorSchema.parse(normalized.error)).toMatchObject({ code, requestId: REQUEST_ID })
}

async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('Expected a tRPC rejection')
}

function stubOps(overrides: Partial<FilesOperations> = {}): FilesOperations {
  return {
    readDir: async () => [],
    hidePath: async () => undefined,
    unhidePath: async () => undefined,
    pinPath: async () => undefined,
    unpinPath: async () => undefined,
    pinnedEntries: async () => [],
    repoScope: async () => ({ hiddenPaths: [], pinnedPaths: [] }),
    readFile: async () => ({ ok: true, value: { type: 'not-found' } }),
    previewHtml: async () => ({ ok: true, value: null }),
    writeTextFile: async () => ({ ok: true, value: undefined }),
    createFile: async () => ({ ok: true, value: undefined }),
    createFolder: async () => ({ ok: true, value: undefined }),
    renamePath: async () => ({ ok: true, value: undefined }),
    duplicatePath: async () => ({ ok: true, value: 'docs/guide copy.md' }),
    trashPath: async () => ({ ok: true, value: undefined }),
    ...overrides,
  }
}

describe('files feature router', () => {
  it('maps readFile to one operation call and returns FileView', async () => {
    const calls: unknown[] = []
    const router = createFilesFeatureRouter(
      stubOps({
        readFile: async (input) => {
          calls.push(input)
          return { ok: true, value: { type: 'text', content: 'hi' } }
        },
      }),
    )
    await expect(
      router.createCaller(PUBLIC_CONTEXT).readFile({ projectPath: PROJECT, path: 'README.md' }),
    ).resolves.toEqual({ type: 'text', content: 'hi' })
    expect(calls).toEqual([{ projectPath: PROJECT, path: 'README.md' }])
  })

  it('maps path-outside-project, not-found, already-exists, and destination-exists', async () => {
    const router = createFilesFeatureRouter(
      stubOps({
        readFile: async () => ({
          ok: false,
          error: { code: 'path-outside-project', path: 'escape' },
        }),
        trashPath: async () => ({
          ok: false,
          error: { code: 'not-found', path: 'missing.txt' },
        }),
        createFile: async () => ({
          ok: false,
          error: { code: 'already-exists', path: 'docs/empty.txt' },
        }),
        renamePath: async () => ({
          ok: false,
          error: { code: 'destination-exists' },
        }),
      }),
    )
    const caller = router.createCaller(PUBLIC_CONTEXT)
    expectPublicCode(
      await rejected(() => caller.readFile({ projectPath: PROJECT, path: 'escape' })),
      'files.path-outside-project',
    )
    expectPublicCode(
      await rejected(() => caller.trashPath({ projectPath: PROJECT, path: 'missing.txt' })),
      'files.not-found',
    )
    expectPublicCode(
      await rejected(() => caller.createFile({ projectPath: PROJECT, path: 'docs/empty.txt' })),
      'files.already-exists',
    )
    expectPublicCode(
      await rejected(() => caller.renamePath({ projectPath: PROJECT, from: 'a.md', to: 'b.md' })),
      'state.conflict',
    )
  })

  it('rejects unknown write keys as request.invalid at the contract boundary', async () => {
    const router = createFilesFeatureRouter(stubOps())
    const error = await rejected(() =>
      callTRPCProcedure({
        router,
        path: 'writeTextFile',
        type: 'mutation',
        ctx: PUBLIC_CONTEXT,
        getRawInput: async () => ({
          projectPath: PROJECT,
          path: 'docs/notes.txt',
          content: 'x',
          encoding: 'utf8',
        }),
        signal: undefined,
        batchIndex: 0,
      }),
    )
    expectPublicCode(error, 'request.invalid')
  })

  it('returns relative duplicatePath output', async () => {
    const router = createFilesFeatureRouter(
      stubOps({
        duplicatePath: async () => ({ ok: true, value: 'docs/guide copy.md' }),
      }),
    )
    await expect(
      router
        .createCaller(PUBLIC_CONTEXT)
        .duplicatePath({ projectPath: PROJECT, path: 'docs/guide.md' }),
    ).resolves.toBe('docs/guide copy.md')
  })

  it('binds tree and scope procedures to the Files operations surface', async () => {
    const calls: unknown[] = []
    const bound = stubOps({
      readDir: async (input) => {
        calls.push(['readDir', input])
        return [
          {
            name: 'src',
            path: `${PROJECT}/src`,
            kind: 'dir' as const,
            hidden: false,
            pinned: true,
          },
        ]
      },
      hidePath: async (...input) => {
        calls.push(['hidePath', input])
      },
      unhidePath: async (...input) => {
        calls.push(['unhidePath', input])
      },
      pinPath: async (...input) => {
        calls.push(['pinPath', input])
      },
      unpinPath: async (...input) => {
        calls.push(['unpinPath', input])
      },
      pinnedEntries: async (input) => {
        calls.push(['pinnedEntries', input])
        return []
      },
      repoScope: async (input) => {
        calls.push(['repoScope', input])
        return { hiddenPaths: [], pinnedPaths: [] }
      },
    })
    const caller = createFilesFeatureRouter(bound).createCaller(PUBLIC_CONTEXT)

    await expect(
      caller.readDir({ repoPath: PROJECT, path: PROJECT, showHidden: false }),
    ).resolves.toEqual([
      {
        name: 'src',
        path: `${PROJECT}/src`,
        kind: 'dir',
        hidden: false,
        pinned: true,
      },
    ])
    await expect(
      caller.hidePath({ repoPath: PROJECT, path: `${PROJECT}/src` }),
    ).resolves.toBeUndefined()
    await expect(
      caller.unhidePath({ repoPath: PROJECT, path: `${PROJECT}/src` }),
    ).resolves.toBeUndefined()
    await expect(
      caller.pinPath({ repoPath: PROJECT, path: `${PROJECT}/src` }),
    ).resolves.toBeUndefined()
    await expect(
      caller.unpinPath({ repoPath: PROJECT, path: `${PROJECT}/src` }),
    ).resolves.toBeUndefined()
    await expect(caller.pinnedEntries(PROJECT)).resolves.toEqual([])
    await expect(caller.repoScope(PROJECT)).resolves.toEqual({ hiddenPaths: [], pinnedPaths: [] })

    expect(calls).toEqual([
      ['readDir', { repoPath: PROJECT, path: PROJECT, showHidden: false }],
      ['hidePath', [PROJECT, `${PROJECT}/src`]],
      ['unhidePath', [PROJECT, `${PROJECT}/src`]],
      ['pinPath', [PROJECT, `${PROJECT}/src`]],
      ['unpinPath', [PROJECT, `${PROJECT}/src`]],
      ['pinnedEntries', PROJECT],
      ['repoScope', PROJECT],
    ])
  })
})
