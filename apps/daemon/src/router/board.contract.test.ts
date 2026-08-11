// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'

// This suite owns the Board tRPC contract seam only: which raw wire input the router accepts and
// which store result it will serialize. Board rules are NOT re-implemented here — the real
// board-store runs against a temporary repository directory created per run, and `readCards`
// delegates to the real implementation except in the one test that injects a malformed row. Only
// the companion home migration is a test-owned seam, so nothing reads or rewrites the human's
// Porcelain home.
const { companion, board } = vi.hoisted(() => ({
  companion: { ensureProjectCompanion: vi.fn(async () => undefined) },
  board: { readCards: vi.fn() },
}))

vi.mock('../project/migrate-home', () => companion)
vi.mock('../stores/board-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stores/board-store')>()
  board.readCards.mockImplementation(actual.readCards)
  return { ...actual, readCards: board.readCards }
})

import { readCards } from '../stores/board-store'
import { createBoardRouter } from './board'

const boardRouter = createBoardRouter()

const REQUEST_ID = '00000000-0000-4000-8000-000000000018'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' }, requestId: REQUEST_ID } as const

function caller() {
  return boardRouter.createCaller(PUBLIC_CONTEXT)
}

/** Deliver raw untrusted input the typed caller cannot express — the wire's own entry point. */
async function callWithRawInput(path: string, type: 'query' | 'mutation', input: unknown) {
  return await callTRPCProcedure({
    router: boardRouter,
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
  root = await mkdtemp(join(tmpdir(), 'porcelain-board-contract-'))
  repo = join(root, 'repo')
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('board router contract input', () => {
  it('rejects an unknown key on a created card without writing the board', async () => {
    const error = await rejected(() =>
      callWithRawInput('addBoardCard', 'mutation', {
        repoPath: repo,
        title: 'Capture the decision',
        order: 5,
      }),
    )

    expectPublicCode(error, 'request.invalid', false)
    expect(await readCards(repo)).toEqual([])
  })

  it('rejects an empty title on create and update', async () => {
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('addBoardCard', 'mutation', { repoPath: repo, title: '' }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('updateBoardCard', 'mutation', {
          repoPath: repo,
          id: 'card-1',
          title: '',
        }),
      ),
      'request.invalid',
      false,
    )
    expect(await readCards(repo)).toEqual([])
  })

  it('rejects a status outside the card vocabulary on move and clear', async () => {
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('moveBoardCard', 'mutation', {
          repoPath: repo,
          id: 'card-1',
          status: 'blocked',
        }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('clearBoardCards', 'mutation', { repoPath: repo, status: 'blocked' }),
      ),
      'request.invalid',
      false,
    )
  })

  it('rejects an object where a bare repository-path query is contracted', async () => {
    const error = await rejected(() => callWithRawInput('boardCards', 'query', { repoPath: repo }))

    expectPublicCode(error, 'request.invalid', false)
  })

  it('rejects a delete without its card id', async () => {
    const error = await rejected(() =>
      callWithRawInput('deleteBoardCard', 'mutation', { repoPath: repo }),
    )

    expectPublicCode(error, 'request.invalid', false)
  })
})

describe('board router contract output', () => {
  it('serializes a created card and reads the board back through the contract', async () => {
    const created = await caller().addBoardCard({
      repoPath: repo,
      title: 'Capture the decision',
      body: 'The body is optional on the wire.',
      status: 'doing',
    })

    expect(created).toMatchObject({
      title: 'Capture the decision',
      body: 'The body is optional on the wire.',
      status: 'doing',
    })
    expect(await caller().boardCards(repo)).toEqual([created])
  })

  it('defaults a created card to todo without a status', async () => {
    const created = await caller().addBoardCard({ repoPath: repo, title: 'Plan the next step' })

    expect(created).toMatchObject({ title: 'Plan the next step', status: 'todo' })
    expect(created.body).toBeUndefined()
  })

  it('serializes void Board mutations as undefined', async () => {
    const created = await caller().addBoardCard({ repoPath: repo, title: 'Record the result' })

    expect(
      await caller().updateBoardCard({ repoPath: repo, id: created.id, title: 'Record it' }),
    ).toBeUndefined()
    expect(
      await caller().moveBoardCard({ repoPath: repo, id: created.id, status: 'done' }),
    ).toBeUndefined()
    expect((await caller().boardCards(repo)).find((card) => card.id === created.id)).toMatchObject({
      title: 'Record it',
      status: 'done',
    })

    expect(await caller().deleteBoardCard({ repoPath: repo, id: created.id })).toBeUndefined()
    expect(await caller().clearBoardCards({ repoPath: repo, status: 'todo' })).toBeUndefined()
  })

  it('refuses to serialize a card list whose stored status violates the contract', async () => {
    board.readCards.mockResolvedValueOnce([
      { id: 'card-broken', title: 'Broken', status: 'blocked', order: 1, createdAt: 1 },
    ] as never)

    expectPublicCode(await rejected(() => caller().boardCards(repo)), 'internal.unexpected', true)
  })
})
