import { join } from 'node:path'
import { ensureAdminToken } from '@backend/net/admin-token'
import { is } from '@electron-toolkit/utils'
import {
  app,
  BrowserWindow,
  ipcMain,
  type UtilityProcess,
  utilityProcess,
  type WebContents,
} from 'electron'
import { z } from 'zod'
import { isDevelopmentProfile } from './development-profile'
import {
  loadRemoteEnvironmentState,
  type RemoteDaemon,
  type RemoteEnvironment,
  type RemoteEnvironmentState,
  saveRemoteEnvironmentState,
} from './remote-daemon'
import { broadcastShellEvent } from './shell-events'

/**
 * Fork and babysit the daemon child (`out/main/daemon/server.js`) — the Electron-free
 * backend the renderer talks to over HTTP/WS on 127.0.0.1. The fork goes through
 * `utilityProcess.fork` and must NEVER go back to child_process + the run-as-Node env
 * switch; the Desktop daemon lifecycle boundary records what that costs.
 *
 * The daemon resolves userData from PORCELAIN_USER_DATA (the shell owns the dev `-dev`
 * suffix) and runs dev seeding under PORCELAIN_DEV. An explicit development profile is
 * preserved for safe packaged-runtime proof; the rest of the env is inherited, so the e2e
 * fixture's PORCELAIN_* overrides reach the daemon-side stores and terminals.
 *
 * Lifecycle: the ready line (`{"port": N}` on stdout) resolves the port; a crash restarts
 * with a capped backoff (give up after 3 rapid failures) and pushes the NEW url to every
 * LOCAL-bound window over `daemon-url-changed`; group route healing uses that channel for
 * remote-bound windows too. Quit kills the child. A utility child has
 * no stdin, so the shell disables the daemon's parent-death watchdog via
 * PORCELAIN_NO_STDIN_WATCHDOG (standalone daemons under plain `node` keep it).
 *
 * Environments are PER WINDOW — each BrowserWindow points at the local child or a saved
 * remote daemon; the local child keeps running so switch-back is instant.
 */

const readyLineSchema = z.object({ port: z.number().int().positive() })

// Set once before any window boots from the local administrator token file.
let token = ''

const MAX_RAPID_FAILURES = 3
const RAPID_WINDOW_MS = 10_000
const RESTART_DELAYS_MS = [500, 1500, 3000]

let child: UtilityProcess | null = null
let port: number | null = null
let quitting = false
let rapidFailures = 0

// Cached saved environments + default for windows that don't specify one.
// `activeId` in remote-daemon.json is the default for new/restore windows only
// (not a process-wide override — each window has its own binding below).
let environmentsCache: RemoteEnvironment[] = []
let defaultEnvironmentId: string | null = null

/** Per-window binding: webContents.id → environment id (null = This device / local). */
const windowEnvIds = new Map<number, string | null>()
/** Per-window remote pair; absent or null = local child. */
const windowDaemons = new Map<number, RemoteDaemon | null>()
/** webContents ids that already have a destroyed cleanup listener. */
const windowCleanupBound = new Set<number>()

/**
 * The local child daemon's pair. Exported so the shell can probe "This device"
 * through the SAME code path as a saved remote (see `environmentStatuses`) — the
 * url is '' until the child reports its port, which reads as unreachable, exactly
 * the state the switcher should show while the daemon is still coming up.
 */
export function localDaemonPair(): { url: string; token: string } {
  return localDaemonInfo()
}

/** The synthetic connection id `environmentDaemonPairs` uses for "This device" when it is a
 * secondary session — a real saved Environment never collides with it (those ids come from
 * `randomUUID()` at pairing). MUST match `THIS_DEVICE_CONNECTION_ID` in the renderer's
 * environment-sessions.ts (apps/web cannot import this main-process module, or the reverse). */
const THIS_DEVICE_CONNECTION_ID = 'this-device'

/**
 * Every daemon pair a window can hold a live secondary session for, given ITS OWN binding.
 * Saved Environments are always candidates; "This device" is included too, but only for a
 * window whose primary IS a saved Environment — a window already primary-bound to the local
 * child has no use for a second connection to itself, and `localDaemonPair()` before the
 * child reports its port would hand out an empty url.
 */
export function environmentDaemonPairs(callerEnvironmentId: string | null): {
  id: string
  name: string
  url: string
  token: string
}[] {
  const saved = environmentsCache.map((env) => ({
    id: env.id,
    name: env.name,
    url: env.url,
    token: env.token,
  }))
  if (callerEnvironmentId === null) return saved
  const local = localDaemonInfo()
  if (local.url === '') return saved
  return [{ id: THIS_DEVICE_CONNECTION_ID, name: 'This device', ...local }, ...saved]
}

function localDaemonInfo(): { url: string; token: string } {
  return { url: port === null ? '' : `http://127.0.0.1:${port}`, token }
}

/** Resolve a saved environment id to its daemon pair (null id → local). */
function resolveEnvironment(envId: string | null | undefined): {
  environmentId: string | null
  daemon: RemoteDaemon | null
} {
  if (envId == null || envId === '') {
    return { environmentId: null, daemon: null }
  }
  const env = environmentsCache.find((e) => e.id === envId)
  if (env === undefined) {
    return { environmentId: null, daemon: null }
  }
  return { environmentId: env.id, daemon: { url: env.url, token: env.token } }
}

/**
 * Bind a window to an environment before it loads (or when the human switches
 * this window). Reloads are fine — WebContents identity survives
 * `location.reload()` / `webContents.reload()`, so the preload getter still
 * sees the same binding on the next boot.
 */
export function setWindowEnvironment(
  webContents: WebContents,
  environmentId: string | null | undefined,
): void {
  const resolved = resolveEnvironment(environmentId)
  const id = webContents.id
  windowEnvIds.set(id, resolved.environmentId)
  windowDaemons.set(id, resolved.daemon)
  // Clean up when the window is destroyed (not on reload — WebContents lives).
  // Register the listener once so re-binding the same window doesn't stack handlers.
  if (!windowCleanupBound.has(id)) {
    windowCleanupBound.add(id)
    webContents.once('destroyed', () => {
      windowCleanupBound.delete(id)
      windowEnvIds.delete(id)
      windowDaemons.delete(id)
    })
  }
}

/** Re-point every open window bound to a group after its route resolver finds a live endpoint. */
export function setWindowRemoteEndpoint(environmentId: string, daemon: RemoteDaemon): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || windowEnvironmentId(window.webContents) !== environmentId) continue
    const current = windowDaemons.get(window.webContents.id)
    if (current?.url === daemon.url && current.token === daemon.token) continue
    windowDaemons.set(window.webContents.id, daemon)
    window.webContents.send('daemon-url-changed', daemon)
  }
}

/** This window's environment id (null = local). */
export function windowEnvironmentId(webContents: WebContents): string | null {
  return windowEnvIds.get(webContents.id) ?? null
}

/** url/token this window should talk to (local child or a remote). */
function daemonInfoFor(webContents: WebContents): { url: string; token: string } {
  const remote = windowDaemons.get(webContents.id)
  if (remote != null) return remote
  return localDaemonInfo()
}

/** Default environment for new windows that don't specify one. */
export function getDefaultEnvironmentId(): string | null {
  return defaultEnvironmentId
}

/** Refresh the in-memory environment list from disk (after add/remove). */
export async function reloadEnvironmentsCache(): Promise<RemoteEnvironmentState> {
  const state = await loadRemoteEnvironmentState()
  environmentsCache = state.environments
  defaultEnvironmentId = state.activeId
  broadcastShellEvent('remote-environments-changed')
  return state
}

/**
 * Persist default environment id (used by bare New Window / app-launch restore)
 * without touching any open window's binding.
 */
export async function setDefaultEnvironmentId(id: string | null): Promise<void> {
  defaultEnvironmentId = id
  const state = await loadRemoteEnvironmentState()
  state.activeId = id
  await saveRemoteEnvironmentState(state)
}

/**
 * After a local daemon restart, only re-point windows that are on the local
 * child — remote-bound windows keep their remote pair.
 */
function pushLocalDaemonInfo(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    const remote = windowDaemons.get(window.webContents.id)
    if (remote != null) {
      // A remote-bound window keeps its remote pair — but it may ALSO hold a second
      // connection to the local daemon ("This device" terminals), which just moved to a
      // new port. Tell it to re-read `localDaemon` rather than talk to a dead port.
      window.webContents.send('shell-event', 'local-daemon-changed')
      continue
    }
    window.webContents.send('daemon-url-changed', localDaemonInfo())
  }
}

/** Resolve the first stdout line into the daemon's port (rejects on an exit before ready). */
function awaitReadyLine(proc: UtilityProcess): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    // stdio: 'pipe' guarantees a stdout stream, but the type is nullable —
    // reject rather than assert so a future stdio change fails loudly.
    const stdout = proc.stdout
    if (stdout === null) {
      reject(new Error('daemon forked without a stdout pipe'))
      return
    }
    let buffer = ''
    const cleanup = (): void => {
      stdout.off('data', onData)
      proc.off('exit', onExit)
    }
    const onData = (chunk: string): void => {
      buffer += chunk
      const newline = buffer.indexOf('\n')
      if (newline === -1) return
      cleanup()
      try {
        resolve(readyLineSchema.parse(JSON.parse(buffer.slice(0, newline))).port)
      } catch (error) {
        reject(new Error(`unparseable daemon ready line: ${String(error)}`))
      }
    }
    // utilityProcess has no 'error' event: a fork that fails to boot (bad module
    // path, immediate crash) surfaces as an early 'exit', so this single handler
    // is what keeps the ready await from hanging on a child that never served.
    const onExit = (code: number): void => {
      cleanup()
      reject(new Error(`daemon exited before ready (code ${code})`))
    }
    stdout.setEncoding('utf8')
    stdout.on('data', onData)
    proc.once('exit', onExit)
  })
}

/** Packaged child script: always `daemon/server.js` under the main bundle dir. */
export function daemonChildScript(mainDir: string): string {
  return join(mainDir, 'daemon', 'server.js')
}

/** Empty argv — no renderer-supplied command or port. */
export const DAEMON_CHILD_ARGV = Object.freeze([] as string[]) as string[]

/**
 * An explicit launcher override keeps development/headless profiles deterministic.
 * Packaged Electron otherwise lets the OS allocate its private renderer port; the installed
 * plugin reaches the same daemon through the profile-scoped local MCP channel instead.
 */
export function daemonChildPort(inherited: string | undefined): string {
  return inherited ?? ''
}

async function launch(): Promise<void> {
  const startedAt = Date.now()
  // Re-read the administrator file on every spawn so a repaired/replaced local
  // credential is picked up after a child crash.
  token = await ensureAdminToken()
  // utilityProcess.fork — never child_process with the run-as-Node env switch:
  // see the fork-bomb note in the module doc above.
  const developmentProfile = isDevelopmentProfile(is.dev)
  const proc = utilityProcess.fork(daemonChildScript(__dirname), DAEMON_CHILD_ARGV, {
    env: {
      ...process.env,
      PORCELAIN_USER_DATA: app.getPath('userData'),
      PORCELAIN_DEV: developmentProfile ? '1' : '',
      PORCELAIN_ADMIN_TOKEN: token,
      PORCELAIN_DAEMON_PORT: daemonChildPort(process.env.PORCELAIN_DAEMON_PORT),
      // A utility child gets NO stdin, so the daemon's stdin parent-death
      // watchdog would insta-exit it; Electron ties the child's lifetime to
      // this app, which supersedes the watchdog here (standalone daemons under
      // plain `node` keep it — see backend/server.ts).
      PORCELAIN_NO_STDIN_WATCHDOG: '1',
      // The dev renderer is served by Vite, so its origin must be CORS-echoed;
      // the packaged file:// renderer sends the "null" origin the daemon always
      // accepts (HTTP uses `null`; WebSocket upgrades use `file://`; the token is
      // the real gate either way).
      PORCELAIN_ALLOWED_ORIGIN:
        is.dev && process.env.ELECTRON_RENDERER_URL
          ? new URL(process.env.ELECTRON_RENDERER_URL).origin
          : '',
    },
    // 'pipe' for the ready line on stdout; utilityProcess can't 'inherit', so
    // stderr is piped too and forwarded below to keep daemon logs in the dev
    // terminal.
    stdio: 'pipe',
  })
  child = proc

  // end:false — process.stderr can't be end()ed, and a plain pipe would try
  // when the child exits.
  proc.stderr?.pipe(process.stderr, { end: false })

  // utilityProcess emits only 'spawn' and 'exit' (no 'error' event): every way
  // down — crash, kill, or a fork that never boots — lands on 'exit'. The flag
  // still guards the restart path against ever double-firing.
  let wentDown = false
  const onChildDown = (description: string): void => {
    if (wentDown) return
    wentDown = true
    if (child === proc) child = null
    if (port !== null) {
      port = null
      broadcastShellEvent('local-daemon-changed')
    }
    if (quitting) return
    // Restart with capped backoff: a crash after a healthy stretch resets the
    // counter; 3 rapid failures in a row means something is structurally broken
    // — stop respawning instead of burning CPU in a crash loop.
    rapidFailures = Date.now() - startedAt > RAPID_WINDOW_MS ? 1 : rapidFailures + 1
    if (rapidFailures > MAX_RAPID_FAILURES) {
      console.error(`[daemon] went down ${rapidFailures} times in quick succession; giving up`)
      return
    }
    console.error(`[daemon] ${description}; restarting`)
    const delay = RESTART_DELAYS_MS[Math.min(rapidFailures, RESTART_DELAYS_MS.length) - 1]
    setTimeout(() => {
      launch().catch((error) => console.error('[daemon] restart failed:', error))
    }, delay)
  }
  proc.on('exit', (code) => onChildDown(`exited (code ${code})`))

  port = await awaitReadyLine(proc)
  // Push the (new) url + token to LOCAL-bound windows after a restart. Remote
  // group route healing uses the same renderer event with its saved token.
  pushLocalDaemonInfo()
}

/** Spawn the daemon and register its url getter + quit teardown. Called once, before the first window. */
export async function startDaemon(): Promise<void> {
  // Resolve the host administrator token before launching the daemon or exposing
  // the getter. Both child and local windows receive the same secret.
  token = await ensureAdminToken()

  // Load saved environments so createWindow can resolve defaultEnvironmentId
  // (and explicit environmentId) before the preload's sync daemon-url getter runs.
  await reloadEnvironmentsCache()

  // Sync getter the preload calls at window boot; restarts push updates over
  // `daemon-url-changed` (see above), so the value survives daemon crashes.
  // Per-window: event.sender is the calling WebContents.
  ipcMain.on('daemon-url', (event) => {
    event.returnValue = daemonInfoFor(event.sender)
  })
  app.on('before-quit', () => {
    quitting = true
    child?.kill()
  })
  await launch()
}
