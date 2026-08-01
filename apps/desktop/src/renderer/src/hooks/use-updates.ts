import type { UpdateStatus } from '@main/updater'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'

export function useUpdateStatus(): UpdateStatus | undefined {
  // Shell-only (Electron auto-updater) — the browser client never queries it.
  const { data } = shellTrpc.updateStatus.useQuery(undefined, { enabled: !isBrowser })
  return data
}

export function useInstallUpdate(): { install: () => void; isInstalling: boolean } {
  const mutation = shellTrpc.installUpdate.useMutation()
  return { install: () => mutation.mutate(), isInstalling: mutation.isPending }
}

export function useCheckForUpdates(): { check: () => void; isChecking: boolean } {
  const utils = shellTrpc.useUtils()
  const mutation = shellTrpc.checkForUpdates.useMutation({
    onSuccess: async () => {
      await utils.updateStatus.invalidate()
    },
  })
  return { check: () => mutation.mutate(), isChecking: mutation.isPending }
}
