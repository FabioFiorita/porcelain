import { onMutationError } from '@renderer/hooks/mutation-error'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpcClient, trpc, trpcClient } from '@renderer/lib/trpc'
import { useCallback, useState } from 'react'

async function invalidateRepoSettings(utils: ReturnType<typeof trpc.useUtils>): Promise<void> {
  await Promise.all([
    utils.actions.invalidate(),
    utils.repoNotes.invalidate(),
    utils.boardCards.invalidate(),
    utils.repoLayers.invalidate(),
    utils.reviewComments.invalidate(),
  ])
}

/**
 * Copy per-repo channel settings between absolute path keys on the *active*
 * daemon (same host remapping, e.g. after a clone to a different path).
 */
export function useCopyRepoSettingsOnDaemon(): {
  copy: (fromPath: string, toPath: string) => Promise<void>
  isPending: boolean
  result: { imported: string[] } | undefined
  error: string | null
} {
  const utils = trpc.useUtils()
  const mutation = trpc.copyRepoSettings.useMutation({
    onSuccess: async () => {
      await invalidateRepoSettings(utils)
    },
    onError: onMutationError('Copy repo settings'),
  })
  return {
    copy: async (fromPath, toPath) => {
      await mutation.mutateAsync({ fromPath, toPath })
    },
    isPending: mutation.isPending,
    result: mutation.data,
    error: mutation.error?.message ?? null,
  }
}

/**
 * Seed the active (often remote) daemon from this Mac's local ~/.porcelain for a
 * given path — shell exports local channels, daemon imports onto the target path.
 * Electron-only (needs the shell).
 */
export function useSeedFromLocalMac(): {
  seed: (localPath: string, remotePath: string) => Promise<void>
  isPending: boolean
  result: { imported: string[] } | undefined
  error: string | null
} {
  const utils = trpc.useUtils()
  const [isPending, setIsPending] = useState(false)
  const [result, setResult] = useState<{ imported: string[] } | undefined>()
  const [error, setError] = useState<string | null>(null)

  const seed = useCallback(
    async (localPath: string, remotePath: string): Promise<void> => {
      if (isBrowser) {
        setError('Seeding from this Mac requires the desktop app')
        return
      }
      setIsPending(true)
      setError(null)
      setResult(undefined)
      try {
        const settings = await shellTrpcClient.exportLocalRepoSettings.query(localPath)
        const imported = await trpcClient.importRepoSettings.mutate({
          repoPath: remotePath,
          settings,
        })
        setResult(imported)
        await invalidateRepoSettings(utils)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        onMutationError('Seed repo settings')({ message })
      } finally {
        setIsPending(false)
      }
    },
    [utils],
  )

  return { seed, isPending, result, error }
}
