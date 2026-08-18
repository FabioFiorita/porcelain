// Install metadata for the shipped agent plugin (`plugins/porcelain/`).
// The plugin bundles the porcelain-companion and porcelain-remote skills; the app only
// tells the user how to install it.

/** Repository slug. Both installers take the repo and find the plugin inside it. */
const PLUGIN_REPO = 'FabioFiorita/porcelain'

/**
 * The plugin carries its own semver (`plugins/porcelain/plugin.json`), injected at build
 * time — it deliberately no longer tracks the product version, because most releases change
 * nothing an agent reads. Shown for reference only: the app cannot see which version a given
 * agent actually has installed, so it never nags about an upgrade.
 */
export const PLUGIN_VERSION = __PORCELAIN_PLUGIN_VERSION__

/**
 * Vendor-neutral install. Auto-detects every agent tool on the machine (Claude Code, Codex,
 * Cursor, Copilot, …) and installs into each one's native plugin system.
 */
export function pluginInstallCommand(): string {
  return `npx plugins add ${PLUGIN_REPO}`
}

/**
 * Claude Code's own route. Costs one extra step but registers a marketplace, which is what
 * lets Claude refresh the plugin in the background instead of the user re-running an install.
 */
export function pluginMarketplaceCommands(): readonly string[] {
  return [`/plugin marketplace add ${PLUGIN_REPO}`, '/plugin install porcelain@porcelain']
}

/**
 * There is no `plugins update` verb — the vendor-neutral CLI only has `add`, and re-running it
 * overwrites. Claude Code refreshes a registered marketplace instead.
 */
export function pluginUpdateCommands(): readonly string[] {
  return [`npx plugins add ${PLUGIN_REPO}`, '/plugin marketplace update porcelain']
}
