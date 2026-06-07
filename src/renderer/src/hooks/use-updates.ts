import type { UpdateStatus } from '@main/updater'
import { trpc } from '@renderer/lib/trpc'

export function useUpdateStatus(): UpdateStatus | undefined {
  const { data } = trpc.updateStatus.useQuery()
  return data
}

export function useInstallUpdate(): { install: () => void; isInstalling: boolean } {
  const mutation = trpc.installUpdate.useMutation()
  return { install: () => mutation.mutate(), isInstalling: mutation.isLoading }
}
