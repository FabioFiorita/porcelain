// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { normalizePublicError } from '../../daemon-composition/public-error'
import type { BoardOperations } from './board-operations'
import { createBoardRouter } from './board-router'

const REQUEST_ID = '00000000-0000-4000-8000-000000000018'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }
const ID = '00000000-0000-4000-8000-0000000000a1'
const REPO = '/synthetic/repo'

function expectPublicCode(error: unknown, code: string, unexpected: boolean) {
  const normalized = normalizePublicError(error, REQUEST_ID)
  expect(normalized.unexpected).toBe(unexpected)
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

function unavailableOps(overrides: Partial<BoardOperations> = {}): BoardOperations {
  return {
    listBoardCards: async () => ({ ok: true, value: [] }),
    createBoardCard: async () => ({ ok: false, error: { code: 'board.unavailable' } }),
    updateBoardCard: async () => ({ ok: false, error: { code: 'board.unavailable' } }),
    moveBoardCard: async () => ({ ok: false, error: { code: 'board.unavailable' } }),
    deleteBoardCard: async () => ({ ok: false, error: { code: 'board.unavailable' } }),
    clearBoardColumn: async () => ({ ok: false, error: { code: 'board.unavailable' } }),
    ...overrides,
  }
}

describe('board feature router (canonical wire names)', () => {
  it('maps listBoardCards project path onto the operation and returns the card list', async () => {
    const calls: unknown[] = []
    const router = createBoardRouter(
      unavailableOps({
        listBoardCards: async (input) => {
          calls.push(input)
          return {
            ok: true,
            value: [
              {
                id: ID,
                title: 'Ship',
                status: 'todo',
                order: 1,
                createdAt: 1,
              },
            ],
          }
        },
      }),
    )

    await expect(router.createCaller(PUBLIC_CONTEXT).listBoardCards(REPO)).resolves.toEqual([
      { id: ID, title: 'Ship', status: 'todo', order: 1, createdAt: 1 },
    ])
    expect(calls).toEqual([{ projectPath: REPO }])
  })

  it('maps createBoardCard and returns the authoritative card', async () => {
    const calls: unknown[] = []
    const router = createBoardRouter(
      unavailableOps({
        createBoardCard: async (input) => {
          calls.push(input)
          return {
            ok: true,
            value: {
              id: ID,
              title: 'Ship',
              status: 'doing',
              order: 2,
              createdAt: 2,
            },
          }
        },
      }),
    )

    await expect(
      router.createCaller(PUBLIC_CONTEXT).createBoardCard({
        projectPath: REPO,
        title: 'Ship',
        status: 'doing',
      }),
    ).resolves.toMatchObject({ id: ID, title: 'Ship', status: 'doing' })
    expect(calls).toEqual([
      {
        projectPath: REPO,
        title: 'Ship',
        body: undefined,
        status: 'doing',
      },
    ])
  })

  it('returns authoritative update output and surfaces board.card-not-found', async () => {
    const calls: unknown[] = []
    const router = createBoardRouter(
      unavailableOps({
        updateBoardCard: async (input) => {
          calls.push(input)
          return { ok: false, error: { code: 'board.card-not-found', cardId: ID } }
        },
      }),
    )

    expectPublicCode(
      await rejected(() =>
        router.createCaller(PUBLIC_CONTEXT).updateBoardCard({
          projectPath: REPO,
          cardId: ID,
          title: 'x',
        }),
      ),
      'board.card-not-found',
      false,
    )
    expect(calls).toEqual([{ projectPath: REPO, cardId: ID, title: 'x', body: undefined }])
  })

  it('returns authoritative outputs for move, delete, and clearColumn', async () => {
    const router = createBoardRouter(
      unavailableOps({
        moveBoardCard: async () => ({
          ok: true,
          value: { id: ID, title: 'Ship', status: 'done', order: 9, createdAt: 1 },
        }),
        deleteBoardCard: async () => ({ ok: true, value: { cardId: ID } }),
        clearBoardColumn: async () => ({
          ok: true,
          value: { status: 'todo', cardIds: [ID] },
        }),
      }),
    )
    const caller = router.createCaller(PUBLIC_CONTEXT)

    await expect(
      caller.moveBoardCard({ projectPath: REPO, cardId: ID, status: 'done' }),
    ).resolves.toMatchObject({ id: ID, status: 'done' })
    await expect(caller.deleteBoardCard({ projectPath: REPO, cardId: ID })).resolves.toEqual({
      cardId: ID,
    })
    await expect(caller.clearBoardColumn({ projectPath: REPO, status: 'todo' })).resolves.toEqual({
      status: 'todo',
      cardIds: [ID],
    })
  })

  it('surfaces board.unavailable and board.invalid-title', async () => {
    const routerUnavailable = createBoardRouter(
      unavailableOps({
        createBoardCard: async () => ({ ok: false, error: { code: 'board.unavailable' } }),
      }),
    )
    expectPublicCode(
      await rejected(() =>
        routerUnavailable.createCaller(PUBLIC_CONTEXT).createBoardCard({
          projectPath: REPO,
          title: 'x',
        }),
      ),
      'board.unavailable',
      false,
    )

    const routerInvalid = createBoardRouter(
      unavailableOps({
        createBoardCard: async () => ({
          ok: false,
          error: { code: 'board.invalid-title', reason: 'blank', maxLength: 240 },
        }),
      }),
    )
    expectPublicCode(
      await rejected(() =>
        routerInvalid.createCaller(PUBLIC_CONTEXT).createBoardCard({
          projectPath: REPO,
          title: 'y',
        }),
      ),
      'board.invalid-title',
      false,
    )
  })

  it('rejects contract-invalid raw input before invoking an operation', async () => {
    let called = false
    const router = createBoardRouter(
      unavailableOps({
        createBoardCard: async () => {
          called = true
          return { ok: false, error: { code: 'board.unavailable' } }
        },
      }),
    )
    const error = await rejected(() =>
      callTRPCProcedure({
        router,
        path: 'createBoardCard',
        type: 'mutation',
        ctx: PUBLIC_CONTEXT,
        getRawInput: async () => ({ projectPath: REPO, title: '' }),
        signal: undefined,
        batchIndex: 0,
      }),
    )
    expectPublicCode(error, 'request.invalid', false)
    expect(called).toBe(false)
  })

  it('redacts unexpected operation throws through the public boundary', async () => {
    const router = createBoardRouter(
      unavailableOps({
        listBoardCards: async () => {
          throw new Error('secret path /home/user/secret')
        },
      }),
    )
    const error = await rejected(() => router.createCaller(PUBLIC_CONTEXT).listBoardCards(REPO))
    const normalized = normalizePublicError(error, REQUEST_ID)
    expect(normalized.unexpected).toBe(true)
    expect(publicErrorSchema.parse(normalized.error).code).toBe('internal.unexpected')
    expect(JSON.stringify(normalized.error)).not.toContain('/home/user/secret')
  })

  it('keeps expectedFailure helper available for correlation fixtures', () => {
    expect(expectedFailure('board.unavailable').code).toBe('board.unavailable')
  })
})
