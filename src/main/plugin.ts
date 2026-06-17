import { spawn } from 'node:child_process'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import {
  installCommands,
  marketplaceManifest,
  PLUGIN_NAME,
  PLUGIN_VERSION,
  pluginManifest,
  pluginMarketplaceDir,
  SKILLS,
} from './plugin-assets'

export interface PluginInstallResult {
  /** True when the `claude` CLI ran the install commands successfully. */
  ok: boolean
  /** Combined stdout/stderr from the install attempt (or the error why it couldn't run). */
  output: string
  /** Always written, even if the CLI couldn't run — the user can install manually from here. */
  marketplaceDir: string
  /** The exact commands to run by hand if the automatic install didn't work. */
  commands: string[]
}

// The built, dependency-free stdio server (electron.vite emits it as a second main
// input). Readable even inside app.asar; we copy its bytes into the plugin dir so
// it becomes a real, runnable file.
function builtServerPath(): string {
  return join(app.getAppPath(), 'out', 'main', 'mcp', 'server.js')
}

/** Materialize the local marketplace + plugin (manifest, skills, copied server). */
export async function writePluginFiles(): Promise<string> {
  const root = pluginMarketplaceDir()
  const plugin = join(root, PLUGIN_NAME)
  await mkdir(join(root, '.claude-plugin'), { recursive: true })
  await mkdir(join(plugin, '.claude-plugin'), { recursive: true })

  await writeFile(
    join(root, '.claude-plugin', 'marketplace.json'),
    JSON.stringify(marketplaceManifest(), null, 2),
  )
  await writeFile(
    join(plugin, '.claude-plugin', 'plugin.json'),
    JSON.stringify(pluginManifest(PLUGIN_VERSION), null, 2),
  )
  for (const skill of SKILLS) {
    const dir = join(plugin, 'skills', skill.name)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'SKILL.md'), skill.content)
  }
  await copyFile(builtServerPath(), join(plugin, 'server.js'))
  return root
}

// GUI apps don't inherit the user's shell PATH, so `claude` (commonly in
// ~/.local/bin, ~/.claude/local, or a brew/npm prefix) often isn't found. Run
// through a login shell AND augment PATH with the usual install locations.
function augmentedPath(): string {
  const extra = [
    join(homedir(), '.local', 'bin'),
    join(homedir(), '.claude', 'local'),
    join(homedir(), '.bun', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
  ]
  return [process.env.PATH ?? '', ...extra].filter(Boolean).join(':')
}

function runInstall(commands: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const shell = process.env.SHELL ?? '/bin/zsh'
    const child = spawn(shell, ['-lc', commands.join(' && ')], {
      env: { ...process.env, PATH: augmentedPath() },
    })
    let output = ''
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.on('error', (error) => resolve({ ok: false, output: `${output}${error.message}`.trim() }))
    child.on('close', (code) => resolve({ ok: code === 0, output: output.trim() }))
  })
}

/**
 * Write the plugin to ~/.porcelain/plugin and try to register it with Claude Code.
 * Writing always succeeds (so manual install stays possible); the CLI run is
 * best-effort and its result is reported so the UI can fall back to copy commands.
 */
export async function installPlugin(): Promise<PluginInstallResult> {
  const marketplaceDir = await writePluginFiles()
  const commands = installCommands()
  const result = await runInstall(commands)
  return { ...result, marketplaceDir, commands }
}
