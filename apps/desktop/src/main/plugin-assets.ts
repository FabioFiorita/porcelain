// Install metadata for the shipped agent plugin (`plugins/porcelain/`).
// The plugin bundles the companion and remote skills. The Electron app can install it into
// Codex; the remaining metadata supports manual installation in other agent clients.

/** Repository slug. Clients resolve the plugin package inside this repository. */
const PLUGIN_REPO = 'FabioFiorita/porcelain'

/**
 * The plugin carries its own semver (`plugins/porcelain/.codex-plugin/plugin.json`), injected at build
 * time — it deliberately no longer tracks the product version, because most releases change
 * nothing an agent reads. Shown for reference only: the app cannot see which version a given
 * agent actually has installed, so it never nags about an upgrade.
 */
export const PLUGIN_VERSION = __PORCELAIN_PLUGIN_VERSION__

/** Repository source for agent clients that support plugins but not Codex installation. */
export function agentPluginRepository(): string {
  return PLUGIN_REPO
}

/** Claude Code's verified marketplace installation route. */
export function claudePluginCommands(): readonly string[] {
  return [`/plugin marketplace add ${PLUGIN_REPO}`, '/plugin install porcelain@porcelain']
}

/** Claude Code keeps marketplace refresh separate from first install; preserve that distinction. */
export function claudePluginUpdateCommands(): readonly string[] {
  return [
    '/plugin marketplace update porcelain',
    '/plugin update porcelain@porcelain',
    '/reload-plugins',
  ]
}
