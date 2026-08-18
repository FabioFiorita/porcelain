import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'

export interface PluginInfo {
  version: string
  installCommand: string
  marketplaceCommands: readonly string[]
  updateCommands: readonly string[]
}

export function usePluginInfo(): PluginInfo | undefined {
  // Shell-only — the browser client hides the Companion block, so this is never queried there.
  const { data } = shellTrpc.pluginInfo.useQuery(undefined, {
    staleTime: Number.POSITIVE_INFINITY,
    enabled: !isBrowser,
  })
  return data
}
