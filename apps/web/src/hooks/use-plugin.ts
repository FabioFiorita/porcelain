import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'

export interface PluginInfo {
  version: string
  agentPluginRepository: string
  claudePluginCommands: readonly string[]
}

const BUNDLED_PLUGIN: PluginInfo = {
  version: __PORCELAIN_PLUGIN_VERSION__,
  agentPluginRepository: 'FabioFiorita/porcelain',
  claudePluginCommands: [
    '/plugin marketplace add FabioFiorita/porcelain',
    '/plugin install porcelain@porcelain',
  ],
}

export function usePluginInfo(): PluginInfo | undefined {
  // Electron reads the shell's copy of the bundled plugin. The browser client is
  // served without that bridge, so it uses the same values baked into this bundle.
  const { data } = shellTrpc.pluginInfo.useQuery(undefined, {
    staleTime: Number.POSITIVE_INFINITY,
    enabled: !isBrowser,
  })
  return isBrowser ? BUNDLED_PLUGIN : data
}
