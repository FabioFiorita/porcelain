#!/usr/bin/env node
/**
 * The shipped plugin carries its own semver, and it may not move without a bump.
 *
 * Skills used to be stamped with the product version (`sync-versions.mjs`), which lied:
 * most releases change nothing an agent reads. The plugin owns its version now — but an
 * independent version is only honest if something forces the bump, because for a Claude
 * marketplace the version field *is* the update mechanism: users receive new content only
 * when it changes. So this hashes everything the plugin ships and refuses a content change
 * that kept the old version.
 *
 * Usage:
 *   node scripts/plugin-version.mjs            # rewrite the lock (fails if a bump is owed)
 *   node scripts/plugin-version.mjs --check    # exit 1 on drift; runs in `pnpm lint`
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

export const PLUGIN_DIR = join(root, 'plugins', 'porcelain')
export const AGENT_MANIFEST = join(PLUGIN_DIR, 'plugin.json')
export const CLAUDE_MANIFEST = join(PLUGIN_DIR, '.claude-plugin', 'plugin.json')
export const MARKETPLACE = join(root, '.claude-plugin', 'marketplace.json')
export const LOCK = join(PLUGIN_DIR, 'plugin.lock.json')

/** Every file the plugin ships, repo-relative and sorted so the hash is stable. */
export function pluginFiles(dir = PLUGIN_DIR) {
  const out = []
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      // The lock is the record of the hash; hashing it would be circular.
      else if (entry.isFile() && full !== LOCK) out.push(full)
    }
  }
  walk(dir)
  return out.sort()
}

/** Content hash over path + bytes, so a rename counts as a change. */
export function hashPlugin(files = pluginFiles()) {
  const digest = createHash('sha256')
  for (const file of files) {
    digest.update(relative(root, file).split('\\').join('/'))
    digest.update('\0')
    digest.update(readFileSync(file))
    digest.update('\0')
  }
  return digest.digest('hex')
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

/**
 * Pure decision so the test can drive every branch without a filesystem.
 * `locked` is null on first run.
 */
export function evaluate({ agentVersion, claudeVersion, marketplaceVersion, hash, locked }) {
  const problems = []
  if (claudeVersion !== agentVersion)
    problems.push(
      `.claude-plugin/plugin.json is ${claudeVersion}, plugin.json is ${agentVersion} — the two manifests ship one plugin and must agree`,
    )
  if (marketplaceVersion != null && marketplaceVersion !== agentVersion)
    problems.push(
      `marketplace entry pins ${marketplaceVersion} but the plugin is ${agentVersion} — omit the field or match it`,
    )
  const changed = locked === null || locked.hash !== hash
  if (changed && locked !== null && locked.version === agentVersion)
    problems.push(
      `plugin content changed but the version is still ${agentVersion} — bump plugins/porcelain/plugin.json (and the Claude manifest), then run \`pnpm plugin:lock\``,
    )
  if (!changed && locked.version !== agentVersion)
    problems.push(
      `plugin.lock.json records ${locked.version} but the manifests say ${agentVersion} — run \`pnpm plugin:lock\``,
    )
  return { problems, changed }
}

/** Entry point split out so importing this module for the test runs nothing. */
function main() {
  const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } })
  const agentVersion = readJson(AGENT_MANIFEST).version
  const claudeVersion = readJson(CLAUDE_MANIFEST).version
  const entry = readJson(MARKETPLACE).plugins.find((p) => p.name === 'porcelain')
  const hash = hashPlugin()
  let locked = null
  try {
    locked = readJson(LOCK)
  } catch {
    // absent on first run — writing it is the bootstrap
  }

  const { problems, changed } = evaluate({
    agentVersion,
    claudeVersion,
    marketplaceVersion: entry?.version ?? null,
    hash,
    locked,
  })

  if (problems.length > 0) {
    for (const problem of problems) console.error(`[plugin-version] ${problem}`)
    process.exit(1)
  }

  if (values.check) {
    if (changed) {
      console.error('[plugin-version] plugin.lock.json is stale — run `pnpm plugin:lock`')
      process.exit(1)
    }
    process.exit(0)
  }

  writeFileSync(LOCK, `${JSON.stringify({ version: agentVersion, hash }, null, 2)}\n`)
  console.log(`[plugin-version] locked porcelain ${agentVersion} (${hash.slice(0, 12)})`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
