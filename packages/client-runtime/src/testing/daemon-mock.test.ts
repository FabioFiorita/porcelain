import { procedureCatalog, publicErrorFixtures, publicErrorSchema } from '@porcelain/contracts'
import { boardNotificationFixtures } from '@porcelain/contracts/board'
import {
  openRepoPathInputSchema,
  openRepoPathOutputSchema,
  projectsContractFixtures,
} from '@porcelain/contracts/projects'
import { sessionChangeSchema } from '@porcelain/contracts/session'
import { describe, expect, it } from 'vitest'
import {
  createValidatingDaemonMock,
  type DaemonMockOutcome,
  type ValidatingDaemonMock,
} from './daemon-mock'

const catalog = {
  procedures: procedureCatalog,
  notification: sessionChangeSchema,
  publicError: publicErrorSchema,
}

const openFixture = projectsContractFixtures.openRepoPath

function mock(
  handlers: Readonly<
    Record<string, (input: unknown) => DaemonMockOutcome | Promise<DaemonMockOutcome>>
  >,
): ValidatingDaemonMock {
  return createValidatingDaemonMock(catalog, handlers)
}

describe('createValidatingDaemonMock', () => {
  it('dispatches a valid request and returns a catalog-valid success value', async () => {
    const daemon = mock({
      openRepoPath: (input) => {
        expect(input).toBe(openFixture.input)
        return { ok: true, value: openFixture.output }
      },
    })

    const outcome = await daemon.dispatch({
      procedure: 'openRepoPath',
      kind: 'mutation',
      input: openFixture.input,
    })

    expect(outcome).toEqual({ ok: true, value: openFixture.output })
    expect(daemon.requests()).toEqual([
      { procedure: 'openRepoPath', kind: 'mutation', input: openFixture.input },
    ])
  })

  it('rejects malformed request input before the handler runs', async () => {
    let called = false
    const daemon = mock({
      openRepoPath: () => {
        called = true
        return { ok: true, value: openFixture.output }
      },
    })

    await expect(
      daemon.dispatch({
        procedure: 'openRepoPath',
        kind: 'mutation',
        input: 42,
      }),
    ).rejects.toThrow()
    expect(called).toBe(false)
    expect(daemon.requests()).toEqual([])
  })

  it('rejects malformed success output before returning to the adapter', async () => {
    const daemon = mock({
      openRepoPath: () => ({ ok: true, value: { path: openFixture.output.path } }),
    })

    await expect(
      daemon.dispatch({
        procedure: 'openRepoPath',
        kind: 'mutation',
        input: openFixture.input,
      }),
    ).rejects.toThrow()
    // Input was valid and recorded; the bad output never left the mock as a success.
    expect(daemon.requests()).toHaveLength(1)
  })

  it('returns a configured expected public error after schema validation', async () => {
    const error = publicErrorFixtures['resource.not-found']
    const daemon = mock({
      openRepoPath: () => ({ ok: false, error }),
    })

    const outcome = await daemon.dispatch({
      procedure: 'openRepoPath',
      kind: 'mutation',
      input: openFixture.input,
    })

    expect(outcome).toEqual({ ok: false, error })
  })

  it('rejects a malformed configured public error', async () => {
    const daemon = mock({
      openRepoPath: () => ({
        ok: false,
        error: { code: 'resource.not-found', message: 'missing fields' },
      }),
    })

    await expect(
      daemon.dispatch({
        procedure: 'openRepoPath',
        kind: 'mutation',
        input: openFixture.input,
      }),
    ).rejects.toThrow()
  })

  it('emits a valid notification to subscribers', () => {
    const daemon = mock({})
    const seen: unknown[] = []
    const unsubscribe = daemon.subscribe((notification) => {
      seen.push(notification)
    })

    const parsed = daemon.emit(boardNotificationFixtures['board.changed'])
    expect(parsed).toEqual(boardNotificationFixtures['board.changed'])
    expect(seen).toEqual([boardNotificationFixtures['board.changed']])

    unsubscribe()
    daemon.emit(boardNotificationFixtures['board.changed'])
    expect(seen).toHaveLength(1)
  })

  it('rejects a malformed notification before listeners run', () => {
    const daemon = mock({})
    let called = false
    daemon.subscribe(() => {
      called = true
    })

    expect(() => daemon.emit({ kind: 'board.changed' })).toThrow()
    expect(called).toBe(false)
  })

  it('records requests and clears them on demand', async () => {
    const daemon = mock({
      openRepoPath: () => ({ ok: true, value: openFixture.output }),
      recentRepos: () => ({ ok: true, value: projectsContractFixtures.recentRepos.output }),
    })

    await daemon.dispatch({
      procedure: 'openRepoPath',
      kind: 'mutation',
      input: openFixture.input,
    })
    await daemon.dispatch({
      procedure: 'recentRepos',
      kind: 'query',
      input: projectsContractFixtures.recentRepos.input,
    })
    expect(daemon.requests()).toHaveLength(2)

    daemon.clearRequests()
    expect(daemon.requests()).toEqual([])
  })

  it('rejects unknown procedures and kind mismatches without calling handlers', async () => {
    let called = false
    const daemon = mock({
      openRepoPath: () => {
        called = true
        return { ok: true, value: openFixture.output }
      },
    })

    await expect(
      daemon.dispatch({
        procedure: 'notARealProcedure',
        kind: 'query',
        input: null,
      }),
    ).rejects.toThrow(/Unknown daemon mock procedure/)

    await expect(
      daemon.dispatch({
        procedure: 'openRepoPath',
        kind: 'query',
        input: openFixture.input,
      }),
    ).rejects.toThrow(/is a mutation, not a query/)
    expect(called).toBe(false)
  })

  it('uses contract schemas for the same shapes fixture helpers accept', () => {
    // Guardrail: the mock catalog entry and fixture helpers agree on wire shape.
    expect(openRepoPathInputSchema.parse(openFixture.input)).toBe(openFixture.input)
    expect(openRepoPathOutputSchema.parse(openFixture.output)).toEqual(openFixture.output)
  })
})
