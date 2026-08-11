import { onMutationError } from '@renderer/hooks/mutation-error'
import { shellTrpc } from '@renderer/lib/trpc'

/**
 * Electron shell reveal; not part of the Files feature domain. Failure is owned the
 * same way `copyPath` owns it — a reveal that silently does nothing looks like a
 * broken menu item, so the shell's refusal reaches a toast.
 */
export function useRevealInFinder(): (path: string) => void {
  const mutation = shellTrpc.revealInFinder.useMutation({
    onError: onMutationError('Reveal in Finder'),
  })
  return (path: string): void => mutation.mutate(path)
}
