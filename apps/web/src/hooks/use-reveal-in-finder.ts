import { shellTrpc } from '@renderer/lib/trpc'

/** Electron shell reveal; not part of the Files feature domain. */
export function useRevealInFinder(): (path: string) => void {
  const mutation = shellTrpc.revealInFinder.useMutation()
  return (path: string): void => mutation.mutate(path)
}
