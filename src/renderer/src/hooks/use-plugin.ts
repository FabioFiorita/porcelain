import type { PluginInstallResult } from '@main/plugin'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'

export function usePluginInfo():
  | { marketplaceDir: string; commands: string[]; version: string }
  | undefined {
  // Shell-only (installs a local plugin from the packaged app) — never queried in
  // the browser client, where the plugin section and update toast render null.
  const { data } = shellTrpc.pluginInfo.useQuery(undefined, {
    staleTime: Number.POSITIVE_INFINITY,
    enabled: !isBrowser,
  })
  return data
}

export function useInstallPlugin(): {
  install: () => void
  isInstalling: boolean
  result: PluginInstallResult | undefined
  error: string | null
} {
  const mutation = shellTrpc.installPlugin.useMutation()
  return {
    install: () => mutation.mutate(),
    isInstalling: mutation.isPending,
    result: mutation.data,
    error: mutation.error?.message ?? null,
  }
}

export function useCursorPluginInfo():
  | { installDir: string; commands: string[]; version: string }
  | undefined {
  const { data } = shellTrpc.cursorPluginInfo.useQuery(undefined, {
    staleTime: Number.POSITIVE_INFINITY,
    enabled: !isBrowser,
  })
  return data
}

export function useInstallCursorPlugin(): {
  install: () => void
  isInstalling: boolean
  result: PluginInstallResult | undefined
  error: string | null
} {
  const mutation = shellTrpc.installCursorPlugin.useMutation()
  return {
    install: () => mutation.mutate(),
    isInstalling: mutation.isPending,
    result: mutation.data,
    error: mutation.error?.message ?? null,
  }
}
