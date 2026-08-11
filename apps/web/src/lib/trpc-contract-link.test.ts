import type { Operation, OperationResultEnvelope } from '@trpc/client'
import { TRPCClientError } from '@trpc/client'
import type { AnyTRPCRouter } from '@trpc/server'
import { type Observable, observable } from '@trpc/server/observable'
import { describe, expect, it, vi } from 'vitest'

import { contractValidationLink } from './trpc-contract-link'

/**
 * The client and the daemon ship independently, so this link is the only thing standing
 * between a drifted payload and the query cache. These drive the link directly — no
 * transport, no React — so each edge is observable on its own.
 */

type Envelope = OperationResultEnvelope<unknown, TRPCClientError<AnyTRPCRouter>>
type Results = Observable<Envelope, TRPCClientError<AnyTRPCRouter>>

/** The link under test, with the transport it would sit above replaced by `next`. */
function drive(op: Operation, next: (op: Operation) => Results): Results {
  return contractValidationLink<AnyTRPCRouter>()({})({ op, next })
}

function operation(overrides: Partial<Operation>): Operation {
  return {
    id: 1,
    type: 'query',
    path: 'repoNotes',
    input: '/synthetic/repo',
    context: {},
    signal: null,
    ...overrides,
  }
}

type Settled = { value?: unknown; error?: unknown; completed: boolean; dispatched: number }

/** Run one operation through the link with a `next` that answers `data`. */
function run(op: Operation, data: unknown): Promise<Settled> {
  const settled: Settled = { completed: false, dispatched: 0 }
  const next = vi.fn(
    (_op: Operation): Results =>
      observable<Envelope, TRPCClientError<AnyTRPCRouter>>((observer) => {
        observer.next({ result: { data } })
        observer.complete()
      }),
  )

  return new Promise((resolve) => {
    drive(op, next).subscribe({
      next: (envelope) => {
        settled.value = 'data' in envelope.result ? envelope.result.data : undefined
      },
      error: (error) => {
        settled.error = error
        settled.dispatched = next.mock.calls.length
        resolve(settled)
      },
      complete: () => {
        settled.completed = true
        settled.dispatched = next.mock.calls.length
        resolve(settled)
      },
    })
  })
}

describe('contractValidationLink', () => {
  it('passes a valid query through and hands back its data unchanged', async () => {
    const settled = await run(operation({}), 'the notes')
    expect(settled.error).toBeUndefined()
    expect(settled.completed).toBe(true)
    expect(settled.value).toBe('the notes')
    expect(settled.dispatched).toBe(1)
  })

  it('passes a valid mutation through', async () => {
    const settled = await run(
      operation({
        type: 'mutation',
        path: 'setRepoNotes',
        input: { repoPath: '/synthetic/repo', notes: 'hi' },
      }),
      undefined,
    )
    expect(settled.error).toBeUndefined()
    expect(settled.completed).toBe(true)
    expect(settled.dispatched).toBe(1)
  })

  it('accepts void procedure input and a void success payload', async () => {
    // Real tRPC leaves `data: undefined` on void outputs (wire body is `{"result":{}}`)
    // and sends `input: undefined` for `z.void()` procedures.
    const voidOut = await run(
      operation({
        type: 'mutation',
        path: 'setRepoNotes',
        input: { repoPath: '/synthetic/repo', notes: '' },
      }),
      undefined,
    )
    expect(voidOut.error).toBeUndefined()
    expect(voidOut.completed).toBe(true)
    expect(voidOut.dispatched).toBe(1)

    const voidIn = await run(
      operation({ type: 'query', path: 'terminalSessions', input: undefined }),
      [],
    )
    expect(voidIn.error).toBeUndefined()
    expect(voidIn.completed).toBe(true)
    expect(voidIn.dispatched).toBe(1)
  })

  it('never dispatches an operation whose input breaks the contract', async () => {
    const invalid: Operation[] = [
      operation({ input: 42 }),
      operation({ type: 'mutation', path: 'setRepoNotes', input: { repoPath: '/r' } }),
      operation({
        type: 'mutation',
        path: 'setRepoNotes',
        input: { repoPath: '/r', notes: 'hi', extra: true },
      }),
      operation({ type: 'mutation', path: 'setRepoNotes', input: undefined }),
    ]

    for (const op of invalid) {
      const settled = await run(op, 'unused')
      expect(settled.error, JSON.stringify(op.input ?? null)).toBeInstanceOf(TRPCClientError)
      expect(String(settled.error)).toContain('input does not match its contract')
      expect(settled.dispatched).toBe(0)
      expect(settled.completed).toBe(false)
    }
  })

  it('rejects a successful result whose data breaks the contract', async () => {
    for (const data of [42, null, { notes: 'the notes' }]) {
      const settled = await run(operation({}), data)
      expect(settled.error, JSON.stringify(data)).toBeInstanceOf(TRPCClientError)
      expect(String(settled.error)).toContain('returned data outside its contract')
      expect(settled.completed).toBe(false)
    }
  })

  it('rejects an unknown procedure without touching the transport', async () => {
    const settled = await run(operation({ path: 'notAProcedure' }), 'anything')
    expect(settled.error).toBeInstanceOf(TRPCClientError)
    expect(String(settled.error)).toContain('is not a Porcelain daemon procedure')
    expect(settled.dispatched).toBe(0)

    // A name borrowed from Object.prototype is not a procedure either.
    const inherited = await run(operation({ path: 'toString' }), 'anything')
    expect(String(inherited.error)).toContain('is not a Porcelain daemon procedure')
    expect(inherited.dispatched).toBe(0)
  })

  it('forwards a transport error unchanged', async () => {
    const failure = new TRPCClientError<AnyTRPCRouter>('UNAUTHORIZED')
    const next = vi.fn(
      (_op: Operation): Results =>
        observable<Envelope, TRPCClientError<AnyTRPCRouter>>((observer) => {
          observer.error(failure)
        }),
    )

    const observed = await new Promise<unknown>((resolve) => {
      drive(operation({}), next).subscribe({
        next: () => undefined,
        error: resolve,
        complete: () => resolve(undefined),
      })
    })

    expect(observed).toBe(failure)
  })

  it('re-emits catalog defaults/transforms on success output (actions)', async () => {
    // Real procedureCatalog `actions` output: actionViewSchema defaults order/createdAt/trusted.
    // A wire payload that omits those fields must parse, and callers must observe the defaults —
    // not the pre-default shape that would sit outside the inferred type.
    const wireAction = {
      id: 'action-build',
      title: 'Build',
      command: 'make build',
      // order, createdAt, trusted omitted — schema defaults apply
    }
    const settled = await run(
      operation({ type: 'query', path: 'actions', input: '/synthetic/repo' }),
      [wireAction],
    )

    expect(settled.error).toBeUndefined()
    expect(settled.completed).toBe(true)
    expect(settled.value).toEqual([
      {
        id: 'action-build',
        title: 'Build',
        command: 'make build',
        order: 0,
        createdAt: 0,
        trusted: false,
      },
    ])
    // Must not be the same reference as the wire array (normalized re-emit).
    expect(settled.value).not.toBe([wireAction])
  })

  it('forwards Zod-normalized input to next (recentRepos default)', async () => {
    // recentRepos input is optional object with includeWorktrees defaulting to false.
    // The server-bound op must carry the parsed value, not the raw {}/undefined ambiguity.
    let seenInput: unknown
    const next = vi.fn(
      (op: Operation): Results =>
        observable<Envelope, TRPCClientError<AnyTRPCRouter>>((observer) => {
          seenInput = op.input
          observer.next({ result: { data: [] } })
          observer.complete()
        }),
    )

    await new Promise<void>((resolve, reject) => {
      drive(operation({ type: 'query', path: 'recentRepos', input: {} }), next).subscribe({
        next: () => undefined,
        error: reject,
        complete: () => resolve(),
      })
    })

    expect(next).toHaveBeenCalledTimes(1)
    expect(seenInput).toEqual({ includeWorktrees: false })
    // Metadata preserved on the forwarded operation.
    const forwarded = next.mock.calls[0]?.[0]
    expect(forwarded?.path).toBe('recentRepos')
    expect(forwarded?.type).toBe('query')
    expect(forwarded?.id).toBe(1)
  })

  it('unsubscribes a synchronous invalid next and ignores later emissions', async () => {
    const cleanup = vi.fn()
    let sourceObserver: {
      next: (value: Envelope) => void
      complete: () => void
    } | null = null

    const next = vi.fn(
      (_op: Operation): Results =>
        observable<Envelope, TRPCClientError<AnyTRPCRouter>>((observer) => {
          sourceObserver = observer
          // Synchronous invalid data — fires before subscribe() returns to the link.
          observer.next({ result: { data: 42 } })
          return cleanup
        }),
    )

    const outerNext = vi.fn()
    const outerComplete = vi.fn()
    const observedError = await new Promise<unknown>((resolve) => {
      drive(operation({}), next).subscribe({
        next: outerNext,
        error: resolve,
        complete: outerComplete,
      })
    })

    expect(observedError).toBeInstanceOf(TRPCClientError)
    expect(String(observedError)).toContain('returned data outside its contract')
    // Source cleanup ran: either via the in-handler optional unsubscribe once assigned,
    // or the post-subscribe terminal path — either way the spy fires exactly once.
    expect(cleanup).toHaveBeenCalledTimes(1)

    // Later source activity must not reach the outer observer after the terminal error.
    sourceObserver?.next({ result: { data: 'the notes' } })
    sourceObserver?.complete()
    expect(outerNext).not.toHaveBeenCalled()
    expect(outerComplete).not.toHaveBeenCalled()
  })
})
