import { type ChildProcessWithoutNullStreams, execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { is } from '@electron-toolkit/utils'
import type { WslDistribution, WslManagedState } from '@porcelain/contracts'
import { app } from 'electron'
import { z } from 'zod'
import { isDevelopmentProfile } from './development-profile'
import { broadcastShellEvent } from './shell-events'
import { discoverWslDistributions } from './wsl-discovery'

const execFileAsync = promisify(execFile)
const PACKAGE_NAME = '@fabiofiorita/porcelain'
const PRODUCT_VERSION = __PORCELAIN_VERSION__
const PORT_BASE = 44_000
const PORT_COUNT = 1_000

const managedEntrySchema = z.object({
  distribution: z.string().min(1),
  port: z
    .number()
    .int()
    .min(PORT_BASE)
    .max(PORT_BASE + PORT_COUNT - 1),
  environmentId: z.string().min(1),
})
const managedFileSchema = z
  .object({ version: z.literal(1), distributions: z.array(managedEntrySchema) })
  .strict()
type ManagedEntry = z.infer<typeof managedEntrySchema>

type RuntimeStatus = { state: WslManagedState; error: string | null }
const runtimeStatuses = new Map<string, RuntimeStatus>()
const children = new Map<string, ChildProcessWithoutNullStreams>()
const starts = new Map<string, Promise<void>>()
let quitting = false
let saveCounter = 0
let lifecycleInstalled = false

const configPath = (): string => join(app.getPath('userData'), 'wsl-environments.json')

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}

async function readManagedEntries(): Promise<ManagedEntry[]> {
  try {
    return managedFileSchema.parse(JSON.parse(await readFile(configPath(), 'utf8'))).distributions
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return []
    throw new Error(`Managed WSL Environment state is invalid at ${configPath()}`)
  }
}

async function writeManagedEntries(entries: ManagedEntry[]): Promise<void> {
  const path = configPath()
  saveCounter += 1
  const temporary = `${path}.tmp-${process.pid}-${saveCounter}`
  try {
    await writeFile(
      temporary,
      `${JSON.stringify({ version: 1, distributions: entries }, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    )
    await rename(temporary, path)
  } finally {
    await unlink(temporary).catch((error: unknown) => {
      if (!isNodeError(error) || error.code !== 'ENOENT') throw error
    })
  }
}

export function preferredWslPort(distribution: string): number {
  const digest = createHash('sha256').update(distribution).digest()
  return PORT_BASE + (digest.readUInt16BE(0) % PORT_COUNT)
}

function profileName(): string {
  if (process.env.PORCELAIN_E2E === '1') {
    return `e2e-${createHash('sha256').update(app.getPath('userData')).digest('hex').slice(0, 12)}`
  }
  return isDevelopmentProfile(is.dev) ? 'development' : 'production'
}

const PROFILE_SCRIPT = `
case "$1" in
  production) porcelain_home="$HOME/.porcelain"; user_data="$HOME/.local/share/porcelain";;
  development) porcelain_home="$HOME/.porcelain-dev-windows"; user_data="$HOME/.local/share/porcelain-dev-windows";;
  e2e-*) porcelain_home="/tmp/porcelain-wsl-$1/home"; user_data="/tmp/porcelain-wsl-$1/user-data";;
  *) exit 64;;
esac
`.trim()

const INSTALL_SCRIPT = `
set -eu
version="$1"
runtime="$HOME/.local/share/porcelain-managed/runtime/$version"
binary="$runtime/node_modules/.bin/porcelain"
if [ ! -x "$binary" ]; then
  mkdir -p "$runtime"
  npm install --no-audit --no-fund --prefix "$runtime" "${PACKAGE_NAME}@$version"
fi
`.trim()

const START_SCRIPT = `
set -eu
${PROFILE_SCRIPT}
version="$2"
port="$3"
binary="$HOME/.local/share/porcelain-managed/runtime/$version/node_modules/.bin/porcelain"
exec env PORCELAIN_HOME="$porcelain_home" PORCELAIN_USER_DATA="$user_data" PORCELAIN_DAEMON_PORT="$port" "$binary" serve --port "$port"
`.trim()

const ISSUE_SCRIPT = `
set -eu
${PROFILE_SCRIPT}
version="$2"
port="$3"
binary="$HOME/.local/share/porcelain-managed/runtime/$version/node_modules/.bin/porcelain"
exec env PORCELAIN_HOME="$porcelain_home" PORCELAIN_USER_DATA="$user_data" PORCELAIN_DAEMON_PORT="$port" "$binary" access issue --name "Porcelain for Windows" --daemon-url "http://127.0.0.1:$port" --base-url "http://127.0.0.1:$port"
`.trim()

async function runWsl(
  distribution: string,
  script: string,
  args: readonly string[],
  timeout: number,
): Promise<string> {
  const { stdout } = await execFileAsync(
    'wsl.exe',
    ['--distribution', distribution, '--exec', 'sh', '-lc', script, 'porcelain-wsl', ...args],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout, windowsHide: true },
  )
  return stdout
}

async function ensureRuntime(distribution: string): Promise<void> {
  await runWsl(distribution, INSTALL_SCRIPT, [PRODUCT_VERSION], 5 * 60_000)
}

async function endpointResponds(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(1_500),
    })
    return response.ok
  } catch {
    return false
  }
}

async function awaitWindowsEndpoint(port: number): Promise<void> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (await endpointResponds(port)) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('The WSL daemon started, but Windows could not reach its localhost endpoint')
}

function awaitReady(child: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => {
      cleanup()
      child.kill()
      reject(new Error('The WSL daemon did not become ready within 30 seconds'))
    }, 30_000)
    const cleanup = (): void => {
      clearTimeout(timer)
      child.stdout.off('data', onData)
      child.off('exit', onExit)
      child.off('error', onError)
    }
    const onData = (chunk: Buffer): void => {
      output += chunk.toString('utf8')
      if (!output.split('\n').some((line) => line.includes('"port"'))) return
      cleanup()
      resolve()
    }
    const onExit = (code: number | null): void => {
      cleanup()
      reject(new Error(`The WSL daemon exited before it was ready (${String(code)})`))
    }
    const onError = (error: Error): void => {
      cleanup()
      reject(error)
    }
    child.stdout.on('data', onData)
    child.once('exit', onExit)
    child.once('error', onError)
  })
}

async function launchDaemon(distribution: string, port: number): Promise<void> {
  if (children.has(distribution) || (await endpointResponds(port))) return
  const child = spawn(
    'wsl.exe',
    [
      '--distribution',
      distribution,
      '--exec',
      'sh',
      '-lc',
      START_SCRIPT,
      'porcelain-wsl',
      profileName(),
      PRODUCT_VERSION,
      String(port),
    ],
    { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
  )
  children.set(distribution, child)
  child.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk))
  child.once('exit', (code) => {
    const wasOwned = children.get(distribution) === child
    if (wasOwned) children.delete(distribution)
    if (wasOwned && !quitting) {
      runtimeStatuses.set(distribution, {
        state: 'error',
        error: `The WSL daemon stopped unexpectedly (${String(code)})`,
      })
      broadcastShellEvent('wsl-environments-changed')
    }
  })
  try {
    await awaitReady(child)
    // WSL reports the Linux listener before localhost forwarding is always ready on
    // the Windows side. Pairing starts from Electron, so prove that route too.
    await awaitWindowsEndpoint(port)
  } catch (error) {
    if (children.get(distribution) === child) children.delete(distribution)
    child.kill()
    throw error
  }
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function startDistribution(distribution: string, port: number): Promise<void> {
  const active = starts.get(distribution)
  if (active !== undefined) return active
  const start = (async () => {
    runtimeStatuses.set(distribution, { state: 'starting', error: null })
    broadcastShellEvent('wsl-environments-changed')
    try {
      await ensureRuntime(distribution)
      await launchDaemon(distribution, port)
      runtimeStatuses.set(distribution, { state: 'online', error: null })
    } catch (error) {
      runtimeStatuses.set(distribution, { state: 'error', error: readableError(error) })
      throw error
    } finally {
      starts.delete(distribution)
      broadcastShellEvent('wsl-environments-changed')
    }
  })()
  starts.set(distribution, start)
  return start
}

async function allocatePort(distribution: string, entries: ManagedEntry[]): Promise<number> {
  const occupied = new Set(entries.map((entry) => entry.port))
  const preferred = preferredWslPort(distribution)
  for (let offset = 0; offset < PORT_COUNT; offset += 1) {
    const candidate = PORT_BASE + ((preferred - PORT_BASE + offset) % PORT_COUNT)
    if (!occupied.has(candidate)) return candidate
  }
  throw new Error('No managed WSL daemon port is available')
}

export async function managedWslDistributions(): Promise<WslDistribution[]> {
  const [distributions, entries] = await Promise.all([
    discoverWslDistributions(),
    readManagedEntries(),
  ])
  return distributions.map((distribution) => {
    const entry = entries.find((candidate) => candidate.distribution === distribution.name)
    const status = runtimeStatuses.get(distribution.name)
    return {
      ...distribution,
      managedState: status?.state ?? (entry === undefined ? 'available' : 'starting'),
      environmentId: entry?.environmentId ?? null,
      managementError: status?.error ?? null,
    }
  })
}

export async function prepareWslEnvironment(
  distribution: string,
): Promise<{ connectionLink: string; port: number; existingEnvironmentId: string | null }> {
  const discovered = (await discoverWslDistributions()).find((entry) => entry.name === distribution)
  if (discovered === undefined) throw new Error(`WSL distribution ${distribution} is not installed`)
  if (!discovered.ready) throw new Error(`WSL distribution ${distribution} is not ready`)

  const entries = await readManagedEntries()
  const existing = entries.find((entry) => entry.distribution === distribution)
  const port = existing?.port ?? (await allocatePort(distribution, entries))
  await startDistribution(distribution, port)
  if (existing !== undefined) {
    return { connectionLink: '', port, existingEnvironmentId: existing.environmentId }
  }
  const connectionLink = (
    await runWsl(distribution, ISSUE_SCRIPT, [profileName(), PRODUCT_VERSION, String(port)], 30_000)
  ).trim()
  if (!/^http:\/\/127\.0\.0\.1:\d+\/pair#token=/.test(connectionLink)) {
    throw new Error('The WSL daemon did not return a valid connection link')
  }
  return { connectionLink, port, existingEnvironmentId: null }
}

export async function rememberWslEnvironment(
  distribution: string,
  port: number,
  environmentId: string,
): Promise<void> {
  const entries = await readManagedEntries()
  await writeManagedEntries([
    ...entries.filter((entry) => entry.distribution !== distribution),
    { distribution, port, environmentId },
  ])
}

export async function forgetManagedWslEnvironment(environmentId: string): Promise<void> {
  const entries = await readManagedEntries()
  const removed = entries.find((entry) => entry.environmentId === environmentId)
  if (removed === undefined) return
  await writeManagedEntries(entries.filter((entry) => entry.environmentId !== environmentId))
  const child = children.get(removed.distribution)
  children.delete(removed.distribution)
  child?.kill()
  runtimeStatuses.delete(removed.distribution)
}

export async function startManagedWslEnvironments(): Promise<void> {
  if (process.platform !== 'win32') return
  if (!lifecycleInstalled) {
    lifecycleInstalled = true
    app.on('before-quit', () => {
      quitting = true
      for (const child of children.values()) child.kill()
      children.clear()
    })
  }
  const entries = await readManagedEntries()
  await Promise.allSettled(
    entries.map((entry) => startDistribution(entry.distribution, entry.port)),
  )
}
