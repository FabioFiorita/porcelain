// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import type { ChannelDispositionValue, Layer } from '@porcelain/contracts/project-data'
import { callTRPCProcedure } from '@trpc/server'
import { describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../../daemon-composition/public-error'
import { DEFAULT_LAYERS } from './default-layers'
import type { ProjectDataOperations } from './project-data-operations'
import { createProjectDataRouter } from './project-data-router'

const REQUEST_ID = '00000000-0000-4000-8000-000000000019'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }
const REPO = '/synthetic/repo'

const CHANNEL: ChannelDispositionValue = {
  key: 'synthetic-channel',
  label: 'Synthetic channel',
  hint: 'A channel key the contract must not close over',
  disposition: 'shared',
  trackedPaths: ['.porcelain/synthetic.json'],
}

const CUSTOM_LAYERS: Layer[] = [{ label: 'Specs', pattern: '(^|/)plans/' }]

function stubOperations(overrides: Partial<ProjectDataOperations> = {}): ProjectDataOperations {
  return {
    repoNotes: vi.fn(async () => ''),
    setRepoNotes: vi.fn(async () => undefined),
    repoLayers: vi.fn(async () => ({ layers: DEFAULT_LAYERS, custom: false })),
    setRepoLayers: vi.fn(async () => undefined),
    companionDispositions: vi.fn(async () => [CHANNEL]),
    companionGitVisibility: vi.fn(async () => ({ hidden: true })),
    setCompanionGitVisibility: vi.fn(async () => ({ changed: true })),
    setCompanionDisposition: vi.fn(async () => ({ untracked: [], revealed: false })),
    recordPublishedReview: vi.fn(async () => undefined),
    ...overrides,
  }
}

async function callWithRawInput(
  router: ReturnType<typeof createProjectDataRouter>,
  path: string,
  type: 'query' | 'mutation',
  input: unknown,
): Promise<unknown> {
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

function expectPublicCode(error: unknown, code: string, unexpected: boolean) {
  const normalized = normalizePublicError(error, REQUEST_ID)
  expect(normalized.unexpected).toBe(unexpected)
  expect(publicErrorSchema.parse(normalized.error)).toMatchObject({ code, requestId: REQUEST_ID })
}

describe('Project Data router', () => {
  it('exposes exactly the eight Project Data procedures', () => {
    const router = createProjectDataRouter(stubOperations())
    expect(Object.keys(router._def.procedures).sort()).toEqual([
      'companionDispositions',
      'companionGitVisibility',
      'repoLayers',
      'repoNotes',
      'setCompanionDisposition',
      'setCompanionGitVisibility',
      'setRepoLayers',
      'setRepoNotes',
    ])
  })

  it('rejects an object where a bare repository-path query is contracted', async () => {
    const operations = stubOperations()
    const router = createProjectDataRouter(operations)
    for (const path of [
      'repoLayers',
      'repoNotes',
      'companionDispositions',
      'companionGitVisibility',
    ]) {
      expectPublicCode(
        await rejected(() => callWithRawInput(router, path, 'query', { repoPath: REPO })),
        'request.invalid',
        false,
      )
    }
    expect(operations.repoLayers).not.toHaveBeenCalled()
    expect(operations.repoNotes).not.toHaveBeenCalled()
    expect(operations.companionDispositions).not.toHaveBeenCalled()
    expect(operations.companionGitVisibility).not.toHaveBeenCalled()
  })

  it('rejects unknown keys on every object-input mutation without a side effect', async () => {
    const operations = stubOperations()
    const router = createProjectDataRouter(operations)

    expectPublicCode(
      await rejected(() =>
        callWithRawInput(router, 'setRepoLayers', 'mutation', {
          repoPath: REPO,
          layers: null,
          reset: true,
        }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput(router, 'setRepoNotes', 'mutation', {
          repoPath: REPO,
          notes: 'x',
          append: true,
        }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput(router, 'setCompanionGitVisibility', 'mutation', {
          repoPath: REPO,
          hidden: true,
          force: true,
        }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput(router, 'setCompanionDisposition', 'mutation', {
          repoPath: REPO,
          key: CHANNEL.key,
          disposition: 'shared',
          stage: true,
        }),
      ),
      'request.invalid',
      false,
    )

    expect(operations.setRepoLayers).not.toHaveBeenCalled()
    expect(operations.setRepoNotes).not.toHaveBeenCalled()
    expect(operations.setCompanionGitVisibility).not.toHaveBeenCalled()
    expect(operations.setCompanionDisposition).not.toHaveBeenCalled()
  })

  it('rejects a layer with a blank label, an empty pattern, or an invalid regular expression', async () => {
    const operations = stubOperations()
    const router = createProjectDataRouter(operations)
    for (const layer of [
      { label: '   ', pattern: 'docs/' },
      { label: 'Docs', pattern: '' },
      { label: 'Docs', pattern: '(' },
    ]) {
      expectPublicCode(
        await rejected(() =>
          callWithRawInput(router, 'setRepoLayers', 'mutation', {
            repoPath: REPO,
            layers: [layer],
          }),
        ),
        'request.invalid',
        false,
      )
    }
    expectPublicCode(
      await rejected(() =>
        callWithRawInput(router, 'setRepoLayers', 'mutation', { repoPath: REPO, layers: [] }),
      ),
      'request.invalid',
      false,
    )
    expect(operations.setRepoLayers).not.toHaveBeenCalled()
  })

  it('rejects an empty channel key and a disposition outside the shared/local vocabulary', async () => {
    const operations = stubOperations()
    const router = createProjectDataRouter(operations)
    expectPublicCode(
      await rejected(() =>
        callWithRawInput(router, 'setCompanionDisposition', 'mutation', {
          repoPath: REPO,
          key: '',
          disposition: 'shared',
        }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput(router, 'setCompanionDisposition', 'mutation', {
          repoPath: REPO,
          key: CHANNEL.key,
          disposition: 'private',
        }),
      ),
      'request.invalid',
      false,
    )
    expect(operations.setCompanionDisposition).not.toHaveBeenCalled()
  })

  it('serializes notes, layers, disposition, and visibility outputs', async () => {
    const operations = stubOperations({
      repoNotes: vi.fn(async () => 'Synthetic note'),
      repoLayers: vi.fn(async () => ({ layers: CUSTOM_LAYERS, custom: true })),
      companionDispositions: vi.fn(async () => [CHANNEL]),
      companionGitVisibility: vi.fn(async () => ({ hidden: true })),
      setCompanionGitVisibility: vi
        .fn()
        .mockResolvedValueOnce({ changed: true })
        .mockResolvedValueOnce({ changed: false }),
      setCompanionDisposition: vi.fn(async () => ({
        untracked: ['.porcelain/synthetic.json'],
        revealed: true,
      })),
    })
    const caller = createProjectDataRouter(operations).createCaller(PUBLIC_CONTEXT)

    expect(await caller.repoNotes(REPO)).toBe('Synthetic note')
    expect(await caller.setRepoNotes({ repoPath: REPO, notes: 'Synthetic note' })).toBeUndefined()
    expect(await caller.repoLayers(REPO)).toEqual({ layers: CUSTOM_LAYERS, custom: true })
    expect(await caller.setRepoLayers({ repoPath: REPO, layers: CUSTOM_LAYERS })).toBeUndefined()
    expect(await caller.setRepoLayers({ repoPath: REPO, layers: null })).toBeUndefined()
    expect(await caller.companionDispositions(REPO)).toEqual([CHANNEL])
    expect(await caller.companionGitVisibility(REPO)).toEqual({ hidden: true })
    expect(await caller.setCompanionGitVisibility({ repoPath: REPO, hidden: true })).toEqual({
      changed: true,
    })
    expect(await caller.setCompanionGitVisibility({ repoPath: REPO, hidden: false })).toEqual({
      changed: false,
    })
    expect(
      await caller.setCompanionDisposition({
        repoPath: REPO,
        key: CHANNEL.key,
        disposition: 'local',
      }),
    ).toEqual({ untracked: ['.porcelain/synthetic.json'], revealed: true })

    expect(operations.repoNotes).toHaveBeenCalledWith(REPO)
    expect(operations.setRepoNotes).toHaveBeenCalledWith({
      repoPath: REPO,
      notes: 'Synthetic note',
    })
    expect(operations.repoLayers).toHaveBeenCalledWith(REPO)
    expect(operations.setRepoLayers).toHaveBeenNthCalledWith(1, {
      repoPath: REPO,
      layers: CUSTOM_LAYERS,
    })
    expect(operations.setRepoLayers).toHaveBeenNthCalledWith(2, { repoPath: REPO, layers: null })
    expect(operations.companionDispositions).toHaveBeenCalledWith(REPO)
    expect(operations.companionGitVisibility).toHaveBeenCalledWith(REPO)
    expect(operations.setCompanionGitVisibility).toHaveBeenNthCalledWith(1, {
      repoPath: REPO,
      hidden: true,
    })
    expect(operations.setCompanionGitVisibility).toHaveBeenNthCalledWith(2, {
      repoPath: REPO,
      hidden: false,
    })
    expect(operations.setCompanionDisposition).toHaveBeenCalledWith({
      repoPath: REPO,
      key: CHANNEL.key,
      disposition: 'local',
    })
  })

  it('serializes starter layers as non-custom when operations report them', async () => {
    const operations = stubOperations()
    const caller = createProjectDataRouter(operations).createCaller(PUBLIC_CONTEXT)
    expect(await caller.repoLayers(REPO)).toEqual({ layers: DEFAULT_LAYERS, custom: false })
  })

  it('refuses to serialize a channel whose disposition violates the contract', async () => {
    const operations = stubOperations({
      companionDispositions: vi.fn(async () => [{ ...CHANNEL, disposition: 'private' as never }]),
    })
    const error = await rejected(() =>
      createProjectDataRouter(operations).createCaller(PUBLIC_CONTEXT).companionDispositions(REPO),
    )
    expectPublicCode(error, 'internal.unexpected', true)
  })
})
