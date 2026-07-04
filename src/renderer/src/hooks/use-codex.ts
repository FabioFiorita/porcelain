import type { CodexInstallResult } from '@main/codex'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'

export function useCodexInfo():
  | { marketplaceDir: string; commands: string[]; version: string }
  | undefined {
  // Shell-only (installs a local Codex plugin) — the browser client hides the
  // codex section, so it never queries this.
  const { data } = shellTrpc.codexInfo.useQuery(undefined, {
    staleTime: Number.POSITIVE_INFINITY,
    enabled: !isBrowser,
  })
  return data
}

export function useInstallCodex(): {
  install: () => void
  isInstalling: boolean
  result: CodexInstallResult | undefined
  error: string | null
} {
  const mutation = shellTrpc.installCodex.useMutation()
  return {
    // mutate (not mutateAsync) so a failure surfaces via `error`, not a floating rejection
    install: () => mutation.mutate(),
    isInstalling: mutation.isPending,
    result: mutation.data,
    error: mutation.error?.message ?? null,
  }
}
