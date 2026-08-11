import type { AppRouter } from '@backend/api'
import {
  createValidatingDaemonMock,
  type DaemonMockOutcome,
  type DaemonMockRequest,
  type ValidatingDaemonMock,
} from '@porcelain/client-runtime/testing/daemon-mock'
import { procedureCatalog, publicErrorSchema } from '@porcelain/contracts'
import { sessionChangeSchema } from '@porcelain/contracts/session'
import { trpc } from '@renderer/lib/trpc'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  type Operation,
  type OperationResultObservable,
  TRPCClientError,
  type TRPCLink,
} from '@trpc/client'
import { observable } from '@trpc/server/observable'

/**
 * Test-only tRPC plumbing for the hook suites. Feature tests may still answer operations by
 * hand through `trpcWrapper` (deferred promises for pending / rollback / reconcile). Suites that
 * need contract validation translate each tRPC op into a `DaemonMockRequest` and dispatch through
 * `createValidatingDaemonMock` — the mock is transport-independent; this file is only the Web
 * adapter. Not imported by any app module.
 */

const validatingCatalog = {
  procedures: procedureCatalog,
  notification: sessionChangeSchema,
  publicError: publicErrorSchema,
} as const

/** Map a tRPC client operation onto the transport-independent mock request shape. */
export function toDaemonMockRequest(op: Operation): DaemonMockRequest {
  if (op.type !== 'query' && op.type !== 'mutation') {
    throw new Error(`Daemon mock harness does not support tRPC ${op.type} operations`)
  }
  return {
    procedure: op.path,
    kind: op.type,
    input: op.input,
  }
}

function stubLink(handle: (op: Operation) => Promise<unknown>): TRPCLink<AppRouter> {
  return () =>
    ({ op }: { op: Operation }): OperationResultObservable<AppRouter, unknown> =>
      observable((observer) => {
        handle(op).then(
          (data) => {
            observer.next({ result: { data } })
            observer.complete()
          },
          (error: Error) => {
            observer.error(TRPCClientError.from(error))
          },
        )
      })
}

/** A `renderHook` wrapper whose every tRPC operation is answered by `handle`. */
export function trpcWrapper(
  handle: (op: Operation) => Promise<unknown>,
): (props: { children: React.ReactNode }) => React.JSX.Element {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const client = trpc.createClient({ links: [stubLink(handle)] })
  return ({ children }: { children: React.ReactNode }): React.JSX.Element => (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}

/**
 * A `renderHook` wrapper that dispatches every tRPC operation through a validating daemon mock.
 * Success values and expected public errors are contract-checked before the React Query cache
 * observes them; deferred handlers remain valid for pending-state proof.
 */
export function trpcWrapperFromMock(
  mock: ValidatingDaemonMock,
): (props: { children: React.ReactNode }) => React.JSX.Element {
  return trpcWrapper(async (op) => {
    const outcome = await mock.dispatch(toDaemonMockRequest(op))
    if (!outcome.ok) {
      const error = outcome.error
      const message =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
          ? error.message
          : 'Daemon mock public error'
      throw Object.assign(new Error(message), { data: error })
    }
    return outcome.value
  })
}

export type DaemonMockHandlers = Readonly<
  Record<string, (input: unknown) => DaemonMockOutcome | Promise<DaemonMockOutcome>>
>

/**
 * Build a validating mock bound to the full procedure catalog and a matching tRPC wrapper.
 * Web feature tests that need contract-valid outcomes start here rather than inventing shapes.
 */
export function createValidatingTrpcHarness(handlers: DaemonMockHandlers): {
  readonly mock: ValidatingDaemonMock
  readonly wrapper: (props: { children: React.ReactNode }) => React.JSX.Element
} {
  const mock = createValidatingDaemonMock(validatingCatalog, handlers)
  return { mock, wrapper: trpcWrapperFromMock(mock) }
}

/** A promise the test settles by hand. */
export function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
} {
  const { promise, resolve, reject } = Promise.withResolvers<T>()
  return { promise, resolve, reject }
}
