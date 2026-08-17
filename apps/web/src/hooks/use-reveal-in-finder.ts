import { onMutationError } from '@renderer/hooks/mutation-error'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'

/**
 * Finder (or the local file manager) can only open a path that exists on this
 * machine. The browser client has no shell, and a remote Environment's checkout
 * lives on another host — both must hide the menu item.
 */
export function canRevealInFinder(input: {
  isBrowser: boolean
  isLocal: boolean | undefined
}): boolean {
  return !input.isBrowser && input.isLocal === true
}

/** True when Reveal in Finder would actually open something on this device. */
export function useCanRevealInFinder(): boolean {
  const { data } = shellTrpc.localDaemon.useQuery(undefined, { enabled: !isBrowser })
  return canRevealInFinder({ isBrowser, isLocal: data?.isLocal })
}

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
