// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { normalizePublicError } from '../../daemon-composition/public-error'
import type { ActionsOperations } from './actions-operations'
import { createActionsRouter } from './actions-router'

const REQUEST_ID = '00000000-0000-4000-8000-000000000018'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }
const ID = 'action-a'
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

function unavailableOps(overrides: Partial<ActionsOperations> = {}): ActionsOperations {
  return {
    listActions: async () => ({ ok: true, value: [] }),
    trustActions: async () => ({ ok: false, error: { code: 'actions.unavailable' } }),
    addAction: async () => ({ ok: false, error: { code: 'actions.unavailable' } }),
    updateAction: async () => ({ ok: false, error: { code: 'actions.unavailable' } }),
    moveAction: async () => ({ ok: false, error: { code: 'actions.unavailable' } }),
    deleteAction: async () => ({ ok: false, error: { code: 'actions.unavailable' } }),
    prepareActionRun: async () => ({ ok: false, error: { code: 'actions.unavailable' } }),
    ...overrides,
  }
}

describe('actions feature router', () => {
  it('maps list/actions query onto the operation and returns the action views', async () => {
    const calls: unknown[] = []
    const router = createActionsRouter(
      unavailableOps({
        listActions: async (input) => {
          calls.push(input)
          return {
            ok: true,
            value: [
              {
                id: ID,
                title: 'Ship',
                command: 'make ship',
                order: 1,
                createdAt: 1,
                trusted: true,
              },
            ],
          }
        },
      }),
    )

    await expect(router.createCaller(PUBLIC_CONTEXT).actions(REPO)).resolves.toEqual([
      {
        id: ID,
        title: 'Ship',
        command: 'make ship',
        order: 1,
        createdAt: 1,
        trusted: true,
      },
    ])
    expect(calls).toEqual([{ projectPath: REPO }])
  })

  it('maps addAction and returns the stored action without trusted', async () => {
    const calls: unknown[] = []
    const router = createActionsRouter(
      unavailableOps({
        addAction: async (input) => {
          calls.push(input)
          return {
            ok: true,
            value: {
              id: ID,
              title: 'Ship',
              command: 'make ship',
              order: 2,
              createdAt: 2,
            },
          }
        },
      }),
    )

    await expect(
      router.createCaller(PUBLIC_CONTEXT).addAction({
        repoPath: REPO,
        title: 'Ship',
        command: 'make ship',
        where: 'local',
      }),
    ).resolves.toMatchObject({ id: ID, title: 'Ship', command: 'make ship' })
    expect(calls).toEqual([
      {
        projectPath: REPO,
        title: 'Ship',
        command: 'make ship',
        where: 'local',
      },
    ])
  })

  it('serializes void mutations as undefined and surfaces actions.not-found', async () => {
    const router = createActionsRouter(
      unavailableOps({
        trustActions: async () => ({ ok: true, value: undefined }),
        updateAction: async () => ({
          ok: false,
          error: { code: 'actions.not-found', actionId: ID },
        }),
        moveAction: async () => ({ ok: true, value: undefined }),
        deleteAction: async () => ({ ok: true, value: undefined }),
      }),
    )
    const caller = router.createCaller(PUBLIC_CONTEXT)

    await expect(caller.trustActions({ repoPath: REPO, ids: [ID] })).resolves.toBeUndefined()
    expectPublicCode(
      await rejected(() => caller.updateAction({ repoPath: REPO, id: ID, title: 'x' })),
      'actions.not-found',
      false,
    )
    await expect(
      caller.moveAction({ repoPath: REPO, id: ID, direction: 'up' }),
    ).resolves.toBeUndefined()
    await expect(caller.deleteAction({ repoPath: REPO, id: ID })).resolves.toBeUndefined()
  })

  it('surfaces actions.unavailable and request.invalid', async () => {
    const routerUnavailable = createActionsRouter(
      unavailableOps({
        addAction: async () => ({ ok: false, error: { code: 'actions.unavailable' } }),
      }),
    )
    expectPublicCode(
      await rejected(() =>
        routerUnavailable.createCaller(PUBLIC_CONTEXT).addAction({
          repoPath: REPO,
          title: 'x',
          command: 'y',
        }),
      ),
      'actions.unavailable',
      false,
    )

    const routerInvalid = createActionsRouter(
      unavailableOps({
        addAction: async () => ({ ok: false, error: { code: 'request.invalid' } }),
      }),
    )
    expectPublicCode(
      await rejected(() =>
        routerInvalid.createCaller(PUBLIC_CONTEXT).addAction({
          repoPath: REPO,
          title: 'y',
          command: 'z',
        }),
      ),
      'request.invalid',
      false,
    )
  })

  it('rejects contract-invalid raw input before invoking an operation', async () => {
    let called = false
    const router = createActionsRouter(
      unavailableOps({
        addAction: async () => {
          called = true
          return { ok: false, error: { code: 'actions.unavailable' } }
        },
      }),
    )
    const error = await rejected(() =>
      callTRPCProcedure({
        router,
        path: 'addAction',
        type: 'mutation',
        ctx: PUBLIC_CONTEXT,
        getRawInput: async () => ({ repoPath: REPO, title: '', command: 'make' }),
        signal: undefined,
        batchIndex: 0,
      }),
    )
    expectPublicCode(error, 'request.invalid', false)
    expect(called).toBe(false)
  })

  it('redacts unexpected operation throws through the public boundary', async () => {
    const router = createActionsRouter(
      unavailableOps({
        listActions: async () => {
          throw new Error('secret path /home/user/secret')
        },
      }),
    )
    const error = await rejected(() => router.createCaller(PUBLIC_CONTEXT).actions(REPO))
    const normalized = normalizePublicError(error, REQUEST_ID)
    expect(normalized.unexpected).toBe(true)
    expect(publicErrorSchema.parse(normalized.error).code).toBe('internal.unexpected')
    expect(JSON.stringify(normalized.error)).not.toContain('/home/user/secret')
  })

  it('keeps expectedFailure helper available for correlation fixtures', () => {
    expect(expectedFailure('actions.unavailable').code).toBe('actions.unavailable')
  })
})
