import { execFile } from 'node:child_process'
import { isAbsolute } from 'node:path'

const MARKETPLACE_SOURCE = 'FabioFiorita/porcelain'
const MARKETPLACE_NAME = 'fabiofiorita'
const PLUGIN_ID = 'porcelain@fabiofiorita'
const COMMAND_TIMEOUT_MS = 120_000

interface CommandResult {
  stdout: string
  stderr: string
}

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

/** Install the public Porcelain marketplace and its plugin into this machine's Codex home. */
export async function installCodexPlugin(
  runner: CommandRunner = runCommand,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CodexPluginInstallResult> {
  const codex = await findCodexExecutable(runner, env)

  try {
    await runner(codex, ['plugin', 'marketplace', 'add', MARKETPLACE_SOURCE, '--json'], env)
    await runner(codex, ['plugin', 'marketplace', 'upgrade', MARKETPLACE_NAME, '--json'], env)
    await runner(codex, ['plugin', 'add', PLUGIN_ID, '--json'], env)
  } catch (error) {
    throw commandError(error, 'Could not add the Porcelain plugin to Codex')
  }

  return { pluginId: PLUGIN_ID }
}
