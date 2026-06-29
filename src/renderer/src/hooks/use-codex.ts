import type { CodexInstallResult } from '@main/codex'
import { trpc } from '@renderer/lib/trpc'

export function useCodexInfo():
  | { marketplaceDir: string; commands: string[]; version: string }
  | undefined {
  const { data } = trpc.codexInfo.useQuery(undefined, { staleTime: Number.POSITIVE_INFINITY })
  return data
}

export function useInstallCodex(): {
  install: () => void
  isInstalling: boolean
  result: CodexInstallResult | undefined
  error: string | null
} {
  const mutation = trpc.installCodex.useMutation()
  return {
    // mutate (not mutateAsync) so a failure surfaces via `error`, not a floating rejection
    install: () => mutation.mutate(),
    isInstalling: mutation.isPending,
    result: mutation.data,
    error: mutation.error?.message ?? null,
  }
}
