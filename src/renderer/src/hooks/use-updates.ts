import type { UpdateStatus } from '@main/updater'
import { trpc } from '@renderer/lib/trpc'

export function useUpdateStatus(): UpdateStatus | undefined {
  const { data } = trpc.updateStatus.useQuery()
  return data
}

export function useInstallUpdate(): { install: () => void; isInstalling: boolean } {
  const mutation = trpc.installUpdate.useMutation()
  return { install: () => mutation.mutate(), isInstalling: mutation.isPending }
}

export function useCheckForUpdates(): { check: () => void; isChecking: boolean } {
  const utils = trpc.useUtils()
  const mutation = trpc.checkForUpdates.useMutation({
    onSuccess: async () => {
      await utils.updateStatus.invalidate()
    },
  })
  return { check: () => mutation.mutate(), isChecking: mutation.isPending }
}
