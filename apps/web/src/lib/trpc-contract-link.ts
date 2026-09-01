import { type ProcedureName, procedureCatalog } from '@porcelain/contracts'
import { TRPCClientError, type TRPCLink } from '@trpc/client'
import type { AnyTRPCRouter } from '@trpc/server'
import { observable } from '@trpc/server/observable'

/**
 * The daemon-procedure contract gate.
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
 * Parsed values are re-emitted because Zod defaults and transforms are part of the
 * canonical contract type, so callers must observe `output.data` / the parsed input rather
 * than the raw wire shape. Operation metadata (id, type, path, context, signal) is preserved.
 *
 * It is generic over the router so it stays free of `@backend/*`; `apps/web/src/lib/trpc.ts`
 * binds it to `AppRouter`. Never compose it into the SHELL router — those procedures are
 * Electron-local and have no public contract.
 *
 * Errors are forwarded untouched: interpreting a public error belongs to the shared remote health
 * model, not this
 * link's.
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

        // A synchronous `next` can emit (and fail) before `subscribe` returns. Track a
        // terminal error so we can unsubscribe immediately after assignment, and ignore any
        // later next/error/complete from the source after we have already errored.
        let terminal = false
        let subscription: { unsubscribe: () => void } | undefined
        // Forward the Zod-normalized input (defaults/transforms) without rewriting metadata.
        subscription = next({ ...op, input: input.data }).subscribe({
          next(envelope) {
            if (terminal) return
            // Only a settled data result carries a payload. Connection-state envelopes
            // have no `data` key. Void procedures still set `data: undefined`, which
            // `z.void()` accepts — so they go through the output schema, not this skip.
            const previous = envelope.result
            if (!('data' in previous)) {
              observer.next(envelope)
              return
            }
            const output = contract.output.safeParse(previous.data)
            if (!output.success) {
              terminal = true
              subscription?.unsubscribe()
              observer.error(
                new TRPCClientError<TRouter>(`${op.path} returned data outside its contract`, {
                  cause: output.error,
                }),
              )
              return
            }
            // Re-emit the Zod-normalized payload. Keep the prior result discriminant
            // (and any other metadata) so connection/state variants stay untouched —
            // only the data-bearing branch reaches here.
            observer.next({
              ...envelope,
              result: { ...previous, data: output.data } as typeof previous,
            })
          },
          error(error) {
            if (terminal) return
            terminal = true
            observer.error(error)
          },
          complete() {
            if (terminal) return
            observer.complete()
          },
        })

        // Sync terminal error: `subscription` was still undefined inside `next`, so tear
        // the source down now that the handle exists.
        if (terminal) {
          subscription.unsubscribe()
        }

        return () => {
          terminal = true
          subscription?.unsubscribe()
        }
      })
}
