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
  return (error) => {
    toast.error(`${action} failed`, { description: error.message })
  }
}
