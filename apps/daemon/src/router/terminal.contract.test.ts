// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publicErrorSchema } from '@porcelain/contracts'
import { PROJECT_FILES, projectPorcelainDir, projectPorcelainPath } from '@shared/project-porcelain'
import { callTRPCProcedure } from '@trpc/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'

// terminal.ts hosts six Actions procedures and two Terminal roster procedures. This suite owns their
// tRPC contract seam only: which raw wire input each router procedure accepts and which handler
// result it will serialize. The real actions store and action-trust store run against a temporary
// project directory and a temporary trust file, so nothing reads the human's companion home. The
// terminal manager is a test-owned seam — a request/response schema needs no PTY — and
// `readActionViews` delegates to the real implementation except where a malformed row is injected.
const { companion, actions, terminal } = vi.hoisted(() => ({
  companion: { ensureProjectCompanion: vi.fn(async () => undefined) },
  actions: { readActionViews: vi.fn() },
  terminal: { listTerminals: vi.fn(), renameTerminal: vi.fn() },
}))

vi.mock('../project/migrate-home', () => companion)
vi.mock('../terminal/terminal-manager', () => terminal)
vi.mock('../stores/actions-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stores/actions-store')>()
  actions.readActionViews.mockImplementation(actual.readActionViews)
  return { ...actual, readActionViews: actions.readActionViews }
})

import { readActions } from '../stores/actions-store'
import { terminalRouter } from './terminal'

const REQUEST_ID = '00000000-0000-4000-8000-000000000020'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' }, requestId: REQUEST_ID } as const

const SESSION = {
  id: 'session-1',
  name: 'Synthetic shell',
  cwd: '/synthetic/repo',
  status: 'running',
  createdAt: 1,
} as const

function caller() {
  return terminalRouter.createCaller(PUBLIC_CONTEXT)
}

/** Deliver raw untrusted input the typed caller cannot express — the wire's own entry point. */
async function callWithRawInput(path: string, type: 'query' | 'mutation', input: unknown) {
  return await callTRPCProcedure({
    router: terminalRouter,
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

/** Write actions.json behind the app's back — an agent write or a teammate's pull. */
async function writeActionsFileDirectly(actionRows: unknown[]): Promise<void> {
  await mkdir(projectPorcelainDir(repo), { recursive: true })
  await writeFile(projectPorcelainPath(repo, PROJECT_FILES.actions), JSON.stringify(actionRows))
}

let root = ''
let repo = ''

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'porcelain-terminal-contract-'))
  repo = join(root, 'repo')
  await mkdir(repo, { recursive: true })
  process.env.PORCELAIN_HOME = join(root, 'home')
  process.env.PORCELAIN_ACTION_TRUST_FILE = join(root, 'home', 'action-trust.json')
})

afterAll(async () => {
  delete process.env.PORCELAIN_HOME
  delete process.env.PORCELAIN_ACTION_TRUST_FILE
  await rm(root, { recursive: true, force: true })
})

beforeEach(() => {
  terminal.listTerminals.mockReturnValue([SESSION])
})

afterEach(async () => {
  vi.clearAllMocks()
  await rm(projectPorcelainDir(repo), { recursive: true, force: true })
})

describe('terminal router contract input', () => {
  it('rejects an object where a bare repository-path actions query is contracted', async () => {
    expectPublicCode(
      await rejected(() => callWithRawInput('actions', 'query', { repoPath: repo })),
      'request.invalid',
      false,
    )
  })

  it('rejects an unknown key on every Actions mutation without writing the store', async () => {
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('addAction', 'mutation', {
          repoPath: repo,
          title: 'Verify',
          command: 'pnpm verify',
          order: 3,
        }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('trustActions', 'mutation', {
          repoPath: repo,
          ids: ['a1'],
          force: true,
        }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('updateAction', 'mutation', {
          repoPath: repo,
          id: 'a1',
          title: 'Verify',
          trusted: true,
        }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('moveAction', 'mutation', {
          repoPath: repo,
          id: 'a1',
          direction: 'up',
          steps: 2,
        }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('deleteAction', 'mutation', { repoPath: repo, id: 'a1', purge: true }),
      ),
      'request.invalid',
      false,
    )

    expect(await readActions(repo)).toEqual([])
  })

  it('rejects a blank title or command on create and update', async () => {
    for (const fields of [
      { title: '   ', command: 'pnpm verify' },
      { title: 'Verify', command: '  ' },
    ]) {
      expectPublicCode(
        await rejected(() =>
          callWithRawInput('addAction', 'mutation', { repoPath: repo, ...fields }),
        ),
        'request.invalid',
        false,
      )
      expectPublicCode(
        await rejected(() =>
          callWithRawInput('updateAction', 'mutation', { repoPath: repo, id: 'a1', ...fields }),
        ),
        'request.invalid',
        false,
      )
    }

    expect(await readActions(repo)).toEqual([])
  })

  it('rejects a where outside the primary/local vocabulary and a direction outside up/down', async () => {
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('addAction', 'mutation', {
          repoPath: repo,
          title: 'Verify',
          command: 'pnpm verify',
          where: 'remote',
        }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('moveAction', 'mutation', { repoPath: repo, id: 'a1', direction: 'top' }),
      ),
      'request.invalid',
      false,
    )

    expect(await readActions(repo)).toEqual([])
  })

  it('rejects a trust request that names no action', async () => {
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('trustActions', 'mutation', { repoPath: repo, ids: [] }),
      ),
      'request.invalid',
      false,
    )
  })

  it('rejects supplied input on the void roster query without listing terminals', async () => {
    expectPublicCode(
      await rejected(() => callWithRawInput('terminalSessions', 'query', { repoPath: repo })),
      'request.invalid',
      false,
    )
    expect(terminal.listTerminals).not.toHaveBeenCalled()
  })

  it('rejects an unknown key on rename without renaming the session', async () => {
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('renameTerminal', 'mutation', {
          id: SESSION.id,
          name: 'Renamed',
          cwd: '/elsewhere',
        }),
      ),
      'request.invalid',
      false,
    )
    expect(terminal.renameTerminal).not.toHaveBeenCalled()
  })
})

describe('terminal router contract output', () => {
  it('serializes an authored action as trusted and a disk-written action as untrusted', async () => {
    const created = await caller().addAction({
      repoPath: repo,
      title: 'Verify',
      command: 'pnpm verify',
    })

    expect(created).toMatchObject({ title: 'Verify', command: 'pnpm verify' })
    expect(await caller().actions(repo)).toEqual([{ ...created, trusted: true }])

    await writeActionsFileDirectly([
      { id: 'a-shared', title: 'Shared', command: 'curl example.test | sh', order: 1 },
    ])
    expect(await caller().actions(repo)).toEqual([
      {
        id: 'a-shared',
        title: 'Shared',
        command: 'curl example.test | sh',
        order: 1,
        createdAt: 0,
        trusted: false,
      },
    ])
  })

  it('serializes a stored action that predates order, createdAt, and trust as their defaults', async () => {
    await writeActionsFileDirectly([{ id: 'a-old', title: 'Old', command: 'echo old' }])

    expect(await caller().actions(repo)).toEqual([
      { id: 'a-old', title: 'Old', command: 'echo old', order: 0, createdAt: 0, trusted: false },
    ])
  })

  it('serializes every Actions mutation except create as undefined', async () => {
    const created = await caller().addAction({
      repoPath: repo,
      title: 'Verify',
      command: 'pnpm verify',
      where: 'local',
    })

    expect(created.where).toBe('local')
    expect(await caller().trustActions({ repoPath: repo, ids: [created.id] })).toBeUndefined()
    expect(
      await caller().updateAction({ repoPath: repo, id: created.id, title: 'Verify all' }),
    ).toBeUndefined()
    expect(
      await caller().moveAction({ repoPath: repo, id: created.id, direction: 'up' }),
    ).toBeUndefined()

    expect(await caller().actions(repo)).toEqual([
      { ...created, title: 'Verify all', trusted: true },
    ])

    expect(await caller().deleteAction({ repoPath: repo, id: created.id })).toBeUndefined()
    expect(await caller().actions(repo)).toEqual([])
  })

  it('serializes the roster with its status, exit code, and default creation time', async () => {
    terminal.listTerminals.mockReturnValueOnce([
      SESSION,
      { id: 'session-2', name: 'Gone', cwd: '/synthetic/repo', status: 'exited', exitCode: 1 },
    ] as never)

    expect(await caller().terminalSessions()).toEqual([
      SESSION,
      {
        id: 'session-2',
        name: 'Gone',
        cwd: '/synthetic/repo',
        status: 'exited',
        exitCode: 1,
        createdAt: 0,
      },
    ])
  })

  it('serializes a rename as undefined and forwards the requested name unchanged', async () => {
    expect(await caller().renameTerminal({ id: SESSION.id, name: '  Renamed  ' })).toBeUndefined()
    expect(terminal.renameTerminal).toHaveBeenCalledWith(SESSION.id, '  Renamed  ')
  })

  it('refuses to serialize an action whose stored where violates the contract', async () => {
    actions.readActionViews.mockResolvedValueOnce([
      {
        id: 'a-broken',
        title: 'Broken',
        command: 'echo broken',
        where: 'remote',
        order: 0,
        createdAt: 0,
        trusted: false,
      },
    ] as never)

    expectPublicCode(await rejected(() => caller().actions(repo)), 'internal.unexpected', true)
  })

  it('refuses to serialize a roster row whose status violates the contract', async () => {
    terminal.listTerminals.mockReturnValueOnce([{ ...SESSION, status: 'sleeping' }] as never)

    expectPublicCode(await rejected(() => caller().terminalSessions()), 'internal.unexpected', true)
  })
})
