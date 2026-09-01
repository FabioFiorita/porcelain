import { execFile } from 'node:child_process'
import { isAbsolute } from 'node:path'
import { z } from 'zod'

const MARKETPLACE_SOURCE = 'FabioFiorita/porcelain'
const MARKETPLACE_NAME = 'fabiofiorita'
const PLUGIN_ID = 'porcelain@fabiofiorita'
const COMMAND_TIMEOUT_MS = 120_000

interface CommandResult {
  stdout: string
  stderr: string
}

const marketplaceListSchema = z.object({
  marketplaces: z.array(z.object({ name: z.string() }).passthrough()),
})
const pluginListSchema = z.object({
  installed: z.array(
    z
      .object({
        pluginId: z.string(),
        version: z.string(),
        installed: z.boolean(),
        enabled: z.boolean(),
      })
      .passthrough(),
  ),
})

export type CommandRunner = (
  executable: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
) => Promise<CommandResult>

function runCommand(
  executable: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      [...args],
      { env, timeout: COMMAND_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error !== null) {
          Object.assign(error, { stdout, stderr })
          reject(error)
          return
        }
        resolve({ stdout, stderr })
      },
    )
  })
}

function isMissingExecutable(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function commandError(error: unknown, fallback: string): Error {
  if (!(error instanceof Error)) return new Error(fallback)
  const stderr =
    'stderr' in error && typeof error.stderr === 'string' ? error.stderr.trim() : undefined
  return new Error(stderr || error.message || fallback)
}

/**
 * Electron launched from Finder does not necessarily inherit the terminal's PATH. Prefer the
 * inherited command, then ask the user's login shell for its absolute path without executing any
 * user-provided command text.
 */
async function findCodexExecutable(runner: CommandRunner, env: NodeJS.ProcessEnv): Promise<string> {
  try {
    await runner('codex', ['--version'], env)
    return 'codex'
  } catch (error) {
    if (!isMissingExecutable(error)) throw commandError(error, 'Could not start Codex')
  }

  const loginShell = env.SHELL
  if (loginShell === undefined || !isAbsolute(loginShell)) {
    throw new Error('Codex CLI was not found. Install Codex and try again.')
  }

  try {
    const result = await runner(loginShell, ['-lc', 'command -v codex'], env)
    const executable = result.stdout.trim().split('\n')[0]
    if (executable === undefined || !isAbsolute(executable)) {
      throw new Error('Codex CLI was not found. Install Codex and try again.')
    }
    return executable
  } catch (error) {
    throw commandError(error, 'Codex CLI was not found. Install Codex and try again.')
  }
}

export interface CodexPluginInstallResult {
  pluginId: string
}

export interface CodexPluginStatus {
  state: 'installed' | 'not-installed' | 'unavailable'
  version: string | null
  enabled: boolean | null
  error: string | null
}

function parseJson<T>(schema: z.ZodType<T>, stdout: string, label: string): T {
  let value: unknown
  try {
    value = JSON.parse(stdout)
  } catch {
    throw new Error(`${label} returned invalid JSON`)
  }
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new Error(`${label} returned an unsupported response`)
  return parsed.data
}

/** Read the installed Porcelain plugin without changing Codex configuration. */
export async function readCodexPluginStatus(
  runner: CommandRunner = runCommand,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CodexPluginStatus> {
  try {
    const codex = await findCodexExecutable(runner, env)
    const result = await runner(codex, ['plugin', 'list', '--json'], env)
    const plugin = parseJson(pluginListSchema, result.stdout, 'Codex plugin list').installed.find(
      (candidate) => candidate.pluginId === PLUGIN_ID && candidate.installed,
    )
    return plugin === undefined
      ? { state: 'not-installed', version: null, enabled: null, error: null }
      : { state: 'installed', version: plugin.version, enabled: plugin.enabled, error: null }
  } catch (error) {
    return {
      state: 'unavailable',
      version: null,
      enabled: null,
      error: commandError(error, 'Could not inspect Codex plugins').message,
    }
  }
}

/** Install the public Porcelain marketplace and its plugin into this machine's Codex home. */
export async function installCodexPlugin(
  runner: CommandRunner = runCommand,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CodexPluginInstallResult> {
  const codex = await findCodexExecutable(runner, env)

  try {
    const marketplaces = parseJson(
      marketplaceListSchema,
      (await runner(codex, ['plugin', 'marketplace', 'list', '--json'], env)).stdout,
      'Codex marketplace list',
    )
    if (!marketplaces.marketplaces.some((marketplace) => marketplace.name === MARKETPLACE_NAME)) {
      await runner(codex, ['plugin', 'marketplace', 'add', MARKETPLACE_SOURCE, '--json'], env)
    }
    await runner(codex, ['plugin', 'marketplace', 'upgrade', MARKETPLACE_NAME, '--json'], env)
    await runner(codex, ['plugin', 'add', PLUGIN_ID, '--json'], env)
  } catch (error) {
    throw commandError(error, 'Could not add the Porcelain plugin to Codex')
  }

  return { pluginId: PLUGIN_ID }
}
