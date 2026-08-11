import { runUserAction } from '@shared/background'
import { toast } from 'sonner'

/**
 * Shared `onError` for mutation hooks so a failed write is never silent. `action`
 * is the human verb phrase for what failed (e.g. 'Stage file'); the toast reads
 * "<action> failed" with the error message beneath — the same shape the delete and
 * branch toasts already use. tRPC client errors and plain Errors both carry
 * `.message`, so the wider `{ message: string }` param stays assignable to every
 * mutation's `onError` slot.
 */
export function onMutationError(action: string): (error: { message: string }) => void {
  return (error: { message: string }): void => {
    toast.error(`${action} failed`, { description: error.message })
  }
}

/** Toast for a user-intent failure from an unknown rejection (runUserAction edges). */
export function toastUserActionError(action: string, error: unknown): void {
  toast.error(`${action} failed`, {
    description: error instanceof Error ? error.message : String(error),
  })
}

/**
 * The blessed pair, pre-composed for an event edge: `runUserAction` with the labelled
 * toast as its error owner. `onClick={toastingAction('Stage file', () => stage(p))}`
 * reads as one thing and keeps the handler synchronous. Not a second idiom — the same
 * two functions, named once instead of retyped at every menu item.
 */
export function toastingAction(label: string, work: () => PromiseLike<unknown>): () => void {
  return (): void => {
    runUserAction(work, (error) => toastUserActionError(label, error))
  }
}

/**
 * Server write succeeded but cache refresh failed: keep success durable for the
 * caller while making the partial outcome visible (not silent, not a full failure).
 */
export async function invalidateAfterSuccess(
  tasks: readonly Promise<unknown>[],
  action: string,
): Promise<void> {
  try {
    await Promise.all(tasks)
  } catch (error) {
    toast.error(`${action} succeeded, but the UI may be stale`, {
      description: error instanceof Error ? error.message : String(error),
    })
  }
}
