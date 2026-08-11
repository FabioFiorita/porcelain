import { type ProcedureName, procedureCatalog } from '@porcelain/contracts'
import { TRPCClientError, type TRPCLink } from '@trpc/client'
import type { AnyTRPCRouter } from '@trpc/server'
import { observable } from '@trpc/server/observable'

/**
 * The daemon-procedure contract gate (Decision 005 / 010).
 *
 * `AppRouter` inference is a compile-time convenience, not a runtime contract: the browser
 * client and the daemon are built and shipped independently, so the only thing that proves a
 * payload is the schema both sides declare. This link sits ABOVE `httpBatchLink` — it sees
 * one operation at a time, before batching — and holds two edges:
 *
 * - input is parsed before a request exists, so a malformed call never leaves the client;
 * - every successful `data` is parsed before React Query (or a vanilla caller) can cache it,
 *   so a daemon that has drifted fails loudly here instead of somewhere in a component.
 *
 * It is generic over the router so it stays free of `@backend/*`; `apps/web/src/lib/trpc.ts`
 * binds it to `AppRouter`. Never compose it into the SHELL router — those procedures are
 * Electron-local and have no public contract.
 *
 * Errors are forwarded untouched: interpreting a public error is REM-003's job, not this
 * link's. Valid payloads pass through by reference — this link validates, it never rewrites
 * what the caller sends or observes.
 */

function contractFor(path: string): (typeof procedureCatalog)[ProcedureName] | undefined {
  return Object.hasOwn(procedureCatalog, path) ? procedureCatalog[path as ProcedureName] : undefined
}

export function contractValidationLink<TRouter extends AnyTRPCRouter>(): TRPCLink<TRouter> {
  return () =>
    ({ op, next }) =>
      observable((observer) => {
        const contract = contractFor(op.path)
        if (contract === undefined) {
          observer.error(
            new TRPCClientError<TRouter>(`${op.path} is not a Porcelain daemon procedure`),
          )
          return
        }

        const input = contract.input.safeParse(op.input)
        if (!input.success) {
          observer.error(
            new TRPCClientError<TRouter>(`${op.path} input does not match its contract`, {
              cause: input.error,
            }),
          )
          return
        }

        // `let` + optional: a synchronous next (unit tests, cached links) can fire
        // before `subscribe` returns, so the handle must already exist.
        let subscription: { unsubscribe: () => void } | undefined
        subscription = next(op).subscribe({
          next(envelope) {
            // Only a settled data result carries a payload. Connection-state envelopes
            // have no `data` key. Void procedures still set `data: undefined`, which
            // `z.void()` accepts — so they go through the output schema, not this skip.
            if (!('data' in envelope.result)) {
              observer.next(envelope)
              return
            }
            const output = contract.output.safeParse(envelope.result.data)
            if (!output.success) {
              subscription?.unsubscribe()
              observer.error(
                new TRPCClientError<TRouter>(`${op.path} returned data outside its contract`, {
                  cause: output.error,
                }),
              )
              return
            }
            observer.next(envelope)
          },
          error(error) {
            observer.error(error)
          },
          complete() {
            observer.complete()
          },
        })

        return () => {
          subscription?.unsubscribe()
        }
      })
}
