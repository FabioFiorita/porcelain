import { join } from 'node:path'
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
import { ensureDaemonToken } from '../backend/token-file'
import {
  loadRemoteEnvironmentState,
  type RemoteDaemon,
  type RemoteEnvironment,
  type RemoteEnvironmentState,
  saveRemoteEnvironmentState,
} from './remote-daemon'

/**
 * Fork and babysit the daemon child (`out/main/daemon/server.js`) — the
 * Electron-free backend the renderer talks to over HTTP/WS on 127.0.0.1.
 *
 * The fork goes through `utilityProcess.fork`, which runs the script in a real
 * Node.js environment inside Electron — node-pty's Electron-ABI build stays
 * valid — and behaves identically in dev and packaged builds. It must NEVER go
 * back to child_process-spawning our own binary with the run-as-Node env
 * switch: packaged builds fuse RunAsNode OFF (build/after-pack.js) and the fuse
 * silently IGNORES that env var, so the child boots as a second full GUI app
 * whose own startDaemon() spawns another — a fork bomb (caught in the v0.19.0
 * pre-publish fuse check).
 * The daemon resolves userData from PORCELAIN_USER_DATA (the shell owns the dev
 * `-dev` suffix, so the config file location never changes) and runs the dev
 * seeding under PORCELAIN_DEV. The rest of the env is inherited — that's how
 * the e2e fixture's PORCELAIN_E2E / PORCELAIN_REVIEW_SETS / PORCELAIN_SHELL
 * overrides reach the daemon-side stores and terminal manager.
 *
 * Lifecycle: the ready line (`{"port": N}` on stdout) resolves the port; a crash
 * restarts the daemon with a capped backoff (give up after 3 rapid failures) and
 * pushes the NEW url to every LOCAL-bound window over `daemon-url-changed` (the
 * renderer's WS client reconnects and queries refetch); quit kills the child.
 * Electron ties a utility child's lifetime to the app, which supersedes the
 * daemon's stdin parent-death watchdog here — utilityProcess provides no stdin
 * at all, so the shell disables the watchdog via PORCELAIN_NO_STDIN_WATCHDOG
 * (standalone daemons under plain `node` keep it).
 *
 * Auth: every daemon request is gated on a persistent session token (see the
 * security note in backend/server.ts — loopback is reachable from any webpage,
 * so the listener must never run open). The token now lives in a shared file,
 * `~/.porcelain/daemon-token` (0600); the shell reads/creates it once at startup
 * (ensureDaemonToken) and hands it to the daemon via env (never argv — argv is
 * visible in `ps`) and to the renderer via the preload getter. A persistent
 * shared token means a restarted daemon — and a standalone/remote daemon that
 * reads the same file — accepts the credentials every open window already holds.
 *
 * Environments are PER WINDOW: each BrowserWindow can point at the local child
 * or a saved remote daemon. The local child always keeps running (instant
 * switch-back and multi-env simultaneous use — local project in one window,
 * Beelink in another). See setWindowEnvironment / daemonInfoFor.
 */

const readyLineSchema = z.object({ port: z.number().int().positive() })

// Set once in startDaemon (before any window boots) from the shared token file.
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

function localDaemonInfo(): { url: string; token: string } {
  return { url: port === null ? '' : `http://127.0.0.1:${port}`, token }
}

/** Resolve a saved environment id to its daemon pair (null id → local). */
export function resolveEnvironment(envId: string | null | undefined): {
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

/** This window's environment id (null = local). */
export function windowEnvironmentId(webContents: WebContents): string | null {
  return windowEnvIds.get(webContents.id) ?? null
}

/** url/token this window should talk to (local child or a remote). */
export function daemonInfoFor(webContents: WebContents): { url: string; token: string } {
  const remote = windowDaemons.get(webContents.id)
  if (remote != null) return remote
  return localDaemonInfo()
}

/** Default environment for new windows that don't specify one. */
export function getDefaultEnvironmentId(): string | null {
  return defaultEnvironmentId
}

export function getEnvironmentsCache(): RemoteEnvironment[] {
  return environmentsCache
}

/** Refresh the in-memory environment list from disk (after add/remove). */
export async function reloadEnvironmentsCache(): Promise<RemoteEnvironmentState> {
  const state = await loadRemoteEnvironmentState()
  environmentsCache = state.environments
  defaultEnvironmentId = state.activeId
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

/** Push daemon info to ONE window (used after a per-window env switch if needed). */
export function pushDaemonInfoTo(webContents: WebContents): void {
  if (!webContents.isDestroyed()) {
    webContents.send('daemon-url-changed', daemonInfoFor(webContents))
  }
}

/**
 * After a local daemon restart, only re-point windows that are on the local
 * child — remote-bound windows must keep their remote pair.
 */
export function pushLocalDaemonInfo(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    const remote = windowDaemons.get(window.webContents.id)
    if (remote != null) continue
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

async function launch(): Promise<void> {
  const startedAt = Date.now()
  // utilityProcess.fork — never child_process with the run-as-Node env switch:
  // see the fork-bomb note in the module doc above.
  const proc = utilityProcess.fork(join(__dirname, 'daemon', 'server.js'), [], {
    env: {
      ...process.env,
      PORCELAIN_USER_DATA: app.getPath('userData'),
      PORCELAIN_DEV: is.dev ? '1' : '',
      PORCELAIN_DAEMON_TOKEN: token,
      // A utility child gets NO stdin, so the daemon's stdin parent-death
      // watchdog would insta-exit it; Electron ties the child's lifetime to
      // this app, which supersedes the watchdog here (standalone daemons under
      // plain `node` keep it — see backend/server.ts).
      PORCELAIN_NO_STDIN_WATCHDOG: '1',
      // The dev renderer is served by Vite, so its origin must be CORS-echoed;
      // the packaged file:// renderer sends the "null" origin the daemon always
      // accepts (the Bearer token is the real gate either way).
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
  // Push the (new) url + token only to LOCAL-bound windows — after a restart the
  // renderer's WS client reconnects here and its queries refetch against the
  // new port. Remote-bound windows keep their remote pair.
  pushLocalDaemonInfo()
}

/** Spawn the daemon and register its url getter + quit teardown. Called once, before the first window. */
export async function startDaemon(): Promise<void> {
  // Resolve the shared token before launching the daemon or exposing the getter —
  // ensureDaemonToken reads ~/.porcelain/daemon-token (creating it 0600 on first
  // run), so both the daemon (via env, below) and every window (via the getter)
  // agree on the same secret. Runs once, before the first window exists.
  token = await ensureDaemonToken()

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
