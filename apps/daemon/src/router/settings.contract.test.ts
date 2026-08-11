// @vitest-environment node
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'

// settings.ts hosts one Git, two Review, one Files, and six Project Data procedures. This suite owns
// their tRPC contract seam only: which raw wire input each router procedure accepts and which
// handler result it will serialize. The layers, notes, and scope stores run for real against a
// temporary project directory created per run. Everything that would touch the machine's Git index,
// PATH, companion home, or a filesystem watcher is a test-owned seam, so nothing here shells out to
// Git or reads the human's companion data.
const { commitGeneration, companion, dispositions, gitExclude, watch } = vi.hoisted(() => ({
  commitGeneration: { listCommitModels: vi.fn() },
  companion: { ensureProjectCompanion: vi.fn(async () => undefined) },
  dispositions: {
    readChannelDispositions: vi.fn(),
    readCompanionGitVisibility: vi.fn(),
    setChannelDisposition: vi.fn(),
  },
  gitExclude: {
    ensureCompanionHidden: vi.fn(async () => undefined),
    hideCompanion: vi.fn(),
    unhideCompanion: vi.fn(),
  },
  watch: { watchProjectCompanion: vi.fn(() => undefined) },
}))

vi.mock('../git/commit-generation', () => commitGeneration)
vi.mock('../project/companion-disposition', () => dispositions)
vi.mock('../project/git-exclude', () => gitExclude)
vi.mock('../project/migrate-home', () => companion)
vi.mock('../review/review-watch', () => watch)

import { DEFAULT_LAYERS } from '../review/flow'
import { readLayers } from '../stores/layers-store'
import { readNotes } from '../stores/notes-store'
import { createSettingsRouter } from './settings'

const settingsRouter = createSettingsRouter()

const REQUEST_ID = '00000000-0000-4000-8000-000000000019'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' }, requestId: REQUEST_ID } as const

const COMMIT_MODEL = { id: 'luna', label: 'Luna', provider: 'claude' } as const
const CHANNEL = {
  key: 'synthetic-channel',
  label: 'Synthetic channel',
  hint: 'A channel key the contract must not close over',
  disposition: 'shared',
  trackedPaths: ['.porcelain/synthetic.json'],
} as const

function caller() {
  return settingsRouter.createCaller(PUBLIC_CONTEXT)
}

/** Deliver raw untrusted input the typed caller cannot express — the wire's own entry point. */
async function callWithRawInput(path: string, type: 'query' | 'mutation', input: unknown) {
  return await callTRPCProcedure({
    router: settingsRouter,
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

let root = ''
let repo = ''

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'porcelain-settings-contract-'))
  repo = join(root, 'repo')
  await mkdir(repo, { recursive: true })
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

beforeEach(() => {
  commitGeneration.listCommitModels.mockResolvedValue([COMMIT_MODEL])
  dispositions.readChannelDispositions.mockResolvedValue([CHANNEL])
  dispositions.readCompanionGitVisibility.mockResolvedValue({ hidden: true })
  dispositions.setChannelDisposition.mockResolvedValue({ untracked: [], revealed: false })
  gitExclude.hideCompanion.mockResolvedValue(true)
  gitExclude.unhideCompanion.mockResolvedValue(false)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.resetAllMocks()
})

describe('settings router contract input', () => {
  it('rejects supplied input on the void commit-model query without listing models', async () => {
    const error = await rejected(() => callWithRawInput('commitModels', 'query', { refresh: true }))

    expectPublicCode(error, 'request.invalid', false)
    expect(commitGeneration.listCommitModels).not.toHaveBeenCalled()
  })

  it('rejects an object where a bare repository-path query is contracted', async () => {
    for (const path of [
      'repoLayers',
      'repoScope',
      'repoNotes',
      'companionDispositions',
      'companionGitVisibility',
    ]) {
      expectPublicCode(
        await rejected(() => callWithRawInput(path, 'query', { repoPath: repo })),
        'request.invalid',
        false,
      )
    }
    expect(dispositions.readChannelDispositions).not.toHaveBeenCalled()
    expect(dispositions.readCompanionGitVisibility).not.toHaveBeenCalled()
  })

  it('rejects unknown keys on every object-input mutation without a side effect', async () => {
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('setRepoLayers', 'mutation', {
          repoPath: repo,
          layers: null,
          reset: true,
        }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('setRepoNotes', 'mutation', { repoPath: repo, notes: 'x', append: true }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('setCompanionGitVisibility', 'mutation', {
          repoPath: repo,
          hidden: true,
          force: true,
        }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('setCompanionDisposition', 'mutation', {
          repoPath: repo,
          key: CHANNEL.key,
          disposition: 'shared',
          stage: true,
        }),
      ),
      'request.invalid',
      false,
    )

    expect(await readLayers(repo)).toBeNull()
    expect(await readNotes(repo)).toBe('')
    expect(gitExclude.hideCompanion).not.toHaveBeenCalled()
    expect(gitExclude.unhideCompanion).not.toHaveBeenCalled()
    expect(dispositions.setChannelDisposition).not.toHaveBeenCalled()
  })

  it('rejects a layer with a blank label, an empty pattern, or an invalid regular expression', async () => {
    for (const layer of [
      { label: '   ', pattern: 'docs/' },
      { label: 'Docs', pattern: '' },
      { label: 'Docs', pattern: '(' },
    ]) {
      expectPublicCode(
        await rejected(() =>
          callWithRawInput('setRepoLayers', 'mutation', { repoPath: repo, layers: [layer] }),
        ),
        'request.invalid',
        false,
      )
    }

    expectPublicCode(
      await rejected(() =>
        callWithRawInput('setRepoLayers', 'mutation', { repoPath: repo, layers: [] }),
      ),
      'request.invalid',
      false,
    )
    expect(await readLayers(repo)).toBeNull()
  })

  it('rejects an empty channel key and a disposition outside the shared/local vocabulary', async () => {
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('setCompanionDisposition', 'mutation', {
          repoPath: repo,
          key: '',
          disposition: 'shared',
        }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('setCompanionDisposition', 'mutation', {
          repoPath: repo,
          key: CHANNEL.key,
          disposition: 'private',
        }),
      ),
      'request.invalid',
      false,
    )
    expect(dispositions.setChannelDisposition).not.toHaveBeenCalled()
  })
})

describe('settings router contract output', () => {
  it('serializes the discovered commit models', async () => {
    expect(await caller().commitModels()).toEqual([COMMIT_MODEL])
  })

  it('serializes the starter layers as non-custom and a stored override as custom', async () => {
    expect(await caller().repoLayers(repo)).toEqual({ layers: DEFAULT_LAYERS, custom: false })

    const layers = [{ label: 'Specs', pattern: '(^|/)plans/' }]
    expect(await caller().setRepoLayers({ repoPath: repo, layers })).toBeUndefined()
    expect(await caller().repoLayers(repo)).toEqual({ layers, custom: true })

    expect(await caller().setRepoLayers({ repoPath: repo, layers: null })).toBeUndefined()
    expect(await caller().repoLayers(repo)).toEqual({ layers: DEFAULT_LAYERS, custom: false })
  })

  it('serializes an unconfigured repo scope as two empty arrays', async () => {
    expect(await caller().repoScope(repo)).toEqual({ hiddenPaths: [], pinnedPaths: [] })
  })

  it('serializes missing notes as the empty string and round-trips a write', async () => {
    expect(await caller().repoNotes(repo)).toBe('')

    expect(await caller().setRepoNotes({ repoPath: repo, notes: 'Synthetic note' })).toBeUndefined()
    expect(await caller().repoNotes(repo)).toBe('Synthetic note')

    expect(await caller().setRepoNotes({ repoPath: repo, notes: '' })).toBeUndefined()
    expect(await caller().repoNotes(repo)).toBe('')
  })

  it('serializes a channel whose key is outside any built-in vocabulary', async () => {
    expect(await caller().companionDispositions(repo)).toEqual([CHANNEL])
  })

  it('serializes hidden visibility and both changed outcomes of setting it', async () => {
    expect(await caller().companionGitVisibility(repo)).toEqual({ hidden: true })

    expect(await caller().setCompanionGitVisibility({ repoPath: repo, hidden: true })).toEqual({
      changed: true,
    })
    expect(gitExclude.hideCompanion).toHaveBeenCalledWith(repo)

    expect(await caller().setCompanionGitVisibility({ repoPath: repo, hidden: false })).toEqual({
      changed: false,
    })
    expect(gitExclude.unhideCompanion).toHaveBeenCalledWith(repo)
  })

  it('serializes the untracked/revealed result of a disposition change', async () => {
    dispositions.setChannelDisposition.mockResolvedValueOnce({
      untracked: ['.porcelain/synthetic.json'],
      revealed: true,
    })

    expect(
      await caller().setCompanionDisposition({
        repoPath: repo,
        key: CHANNEL.key,
        disposition: 'local',
      }),
    ).toEqual({ untracked: ['.porcelain/synthetic.json'], revealed: true })
    expect(dispositions.setChannelDisposition).toHaveBeenCalledWith(repo, CHANNEL.key, 'local')
  })

  it('refuses to serialize a commit model whose provider violates the contract', async () => {
    commitGeneration.listCommitModels.mockResolvedValueOnce([
      { id: 'luna', label: 'Luna', provider: 'unknown-provider' },
    ])

    expectPublicCode(await rejected(() => caller().commitModels()), 'internal.unexpected', true)
  })

  it('refuses to serialize a channel whose disposition violates the contract', async () => {
    dispositions.readChannelDispositions.mockResolvedValueOnce([
      { ...CHANNEL, disposition: 'private' },
    ])

    expectPublicCode(
      await rejected(() => caller().companionDispositions(repo)),
      'internal.unexpected',
      true,
    )
  })
})
