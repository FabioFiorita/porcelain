import type { UpdateStatus } from '@main/updater'
import { shellTrpc } from '@renderer/lib/trpc'

export function useUpdateStatus(): UpdateStatus | undefined {
  const { data } = shellTrpc.updateStatus.useQuery()
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
