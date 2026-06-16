import type { PluginInstallResult } from '@main/plugin'
import { trpc } from '@renderer/lib/trpc'

export function usePluginInfo():
  | { marketplaceDir: string; commands: string[]; version: string }
  | undefined {
  const { data } = trpc.pluginInfo.useQuery(undefined, { staleTime: Number.POSITIVE_INFINITY })
  return data
}

export function useInstallPlugin(): {
  install: () => void
  isInstalling: boolean
  result: PluginInstallResult | undefined
  error: string | null
} {
  const mutation = trpc.installPlugin.useMutation()
  return {
    // mutate (not mutateAsync) so a failure surfaces via `error`, not a floating rejection
    install: () => mutation.mutate(),
    isInstalling: mutation.isPending,
    result: mutation.data,
    error: mutation.error?.message ?? null,
  }
}
