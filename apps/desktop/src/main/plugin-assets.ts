// Install metadata for the shipped agent plugin (`plugins/porcelain/`).
// The plugin bundles the companion and remote skills; the app only
// tells the user how to install it.

/** Repository slug. Clients resolve the plugin package inside this repository. */
const PLUGIN_REPO = 'FabioFiorita/porcelain'

/**
 * The plugin carries its own semver (`plugins/porcelain/.codex-plugin/plugin.json`), injected at build
 * time — it deliberately no longer tracks the product version, because most releases change
 * nothing an agent reads. Shown for reference only: the app cannot see which version a given
 * agent actually has installed, so it never nags about an upgrade.
 */
export const PLUGIN_VERSION = __PORCELAIN_PLUGIN_VERSION__

/**
 * Agent Plugins intentionally leaves installation and distribution to each client. Show the
 * repository rather than inventing a vendor-neutral command that no standard defines.
 */
export function agentPluginRepository(): string {
  return PLUGIN_REPO
}

/** Claude Code's verified marketplace installation route. */
export function claudePluginCommands(): readonly string[] {
  return [`/plugin marketplace add ${PLUGIN_REPO}`, '/plugin install porcelain@porcelain']
}
