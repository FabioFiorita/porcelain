import type { AppRouter } from '@backend/api'
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
 * Test-only tRPC plumbing for the hook suites. The optimistic-update contract is only
 * observable through a real React-Query cache, so the hook tests mount the real
 * `trpc.Provider` over a terminating link the test answers by hand — that lets a suite
 * hold a mutation open and inspect the cache before it settles, or reject it and watch
 * the rollback. Not imported by any app module.
 */
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

/** A promise the test settles by hand. */
export function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
} {
  const { promise, resolve, reject } = Promise.withResolvers<T>()
  return { promise, resolve, reject }
}
