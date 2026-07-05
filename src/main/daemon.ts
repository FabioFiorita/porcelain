import { type ChildProcessByStdio, spawn } from 'node:child_process'
import { join } from 'node:path'
import type { Readable, Writable } from 'node:stream'
import { is } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain } from 'electron'
import { z } from 'zod'
import { ensureDaemonToken } from '../backend/token-file'
import { loadRemoteDaemon, type RemoteDaemon } from './remote-daemon'

/**
 * Spawn and babysit the daemon child (`out/main/daemon/server.js`) — the
 * Electron-free backend the renderer talks to over HTTP/WS on 127.0.0.1.
 *
 * `ELECTRON_RUN_AS_NODE` runs the same Electron binary as plain Node, which
 * keeps node-pty's Electron-ABI build valid inside the daemon. The daemon
 * resolves userData from PORCELAIN_USER_DATA (the shell owns the dev `-dev`
 * suffix, so the config file location never changes) and runs the dev seeding
 * under PORCELAIN_DEV. The rest of the env is inherited — that's how the e2e
 * fixture's PORCELAIN_E2E / PORCELAIN_REVIEW_SETS / PORCELAIN_SHELL overrides
 * reach the daemon-side stores and terminal manager.
 *
 * Lifecycle: the ready line (`{"port": N}` on stdout) resolves the port; a crash
 * restarts the daemon with a capped backoff (give up after 3 rapid failures) and
 * pushes the NEW url to every window over `daemon-url-changed` (the renderer's
 * WS client reconnects and queries refetch); quit kills the child, and the
 * daemon also self-exits when its stdin pipe closes (parent death).
 *
 * Auth: every daemon request is gated on a persistent session token (see the
 * security note in backend/server.ts — loopback is reachable from any webpage,
 * so the listener must never run open). The token now lives in a shared file,
 * `~/.porcelain/daemon-token` (0600); the shell reads/creates it once at startup
 * (ensureDaemonToken) and hands it to the daemon via env (never argv — argv is
 * visible in `ps`) and to the renderer via the preload getter. A persistent
 * shared token means a restarted daemon — and a standalone/remote daemon that
 * reads the same file — accepts the credentials every open window already holds.
 */

const readyLineSchema = z.object({ port: z.number().int().positive() })

// Set once in startDaemon (before any window boots) from the shared token file.
let token = ''

type DaemonProcess = ChildProcessByStdio<Writable, Readable, null>

const MAX_RAPID_FAILURES = 3
const RAPID_WINDOW_MS = 10_000
const RESTART_DELAYS_MS = [500, 1500, 3000]

let child: DaemonProcess | null = null
let port: number | null = null
let quitting = false
let rapidFailures = 0

// When set, every window is pointed at a REMOTE daemon (over the tailnet) instead
// of the local child. The local daemon keeps running underneath (it costs little,
// and it makes switching back instant); daemonInfo just returns the remote pair
// while this is non-null. Persisted in remote-daemon.json (see remote-daemon.ts).
let remoteOverride: RemoteDaemon | null = null

/** url is '' until the first ready line — the preload getter turns that into the renderer fallback. */
export function daemonInfo(): { url: string; token: string } {
  if (remoteOverride !== null) return remoteOverride
  return { url: port === null ? '' : `http://127.0.0.1:${port}`, token }
}

/** Point every window at a remote daemon (or clear back to local with null). Caller persists + pushes. */
export function setRemoteOverride(value: RemoteDaemon | null): void {
  remoteOverride = value
}

/** Push the current daemonInfo to every open window (the same channel a daemon restart uses). */
export function pushDaemonInfo(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('daemon-url-changed', daemonInfo())
  }
}

/** Resolve the first stdout line into the daemon's port (rejects on early exit or spawn error). */
function awaitReadyLine(proc: DaemonProcess): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    let buffer = ''
    const cleanup = (): void => {
      proc.stdout.off('data', onData)
      proc.off('exit', onExit)
      proc.off('error', onError)
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
    const onExit = (code: number | null): void => {
      cleanup()
      reject(new Error(`daemon exited before ready (code ${code})`))
    }
    // 'exit' is NOT guaranteed after 'error' (e.g. a failed spawn) — reject
    // here too so the ready await can never hang on a child that never ran.
    const onError = (error: Error): void => {
      cleanup()
      reject(new Error(`daemon failed to spawn: ${error.message}`))
    }
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', onData)
    proc.once('exit', onExit)
    proc.once('error', onError)
  })
}

async function launch(): Promise<void> {
  const startedAt = Date.now()
  const proc = spawn(process.execPath, [join(__dirname, 'daemon', 'server.js')], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORCELAIN_USER_DATA: app.getPath('userData'),
      PORCELAIN_DEV: is.dev ? '1' : '',
      PORCELAIN_DAEMON_TOKEN: token,
      // The dev renderer is served by Vite, so its origin must be CORS-echoed;
      // the packaged file:// renderer sends the "null" origin the daemon always
      // accepts (the Bearer token is the real gate either way).
      PORCELAIN_ALLOWED_ORIGIN:
        is.dev && process.env.ELECTRON_RENDERER_URL
          ? new URL(process.env.ELECTRON_RENDERER_URL).origin
          : '',
    },
    // stdin stays piped for the daemon's parent-death watchdog; stderr flows
    // into the shell's stderr so daemon logs surface in the dev terminal.
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  child = proc

  // One shared down-handler for 'exit' AND 'error': a failed spawn emits only
  // 'error' (an unhandled 'error' would crash the Electron main process, and
  // 'exit' may never follow), while a crash emits 'exit' — and some failures
  // emit both, so the flag guards against double-scheduling a restart.
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
  proc.on('error', (error) => onChildDown(`spawn failed: ${error.message}`))

  port = await awaitReadyLine(proc)
  // Push the (new) url + token to every open window — after a restart the
  // renderer's WS client reconnects here and its queries refetch against the
  // new port (the token is stable per app run, sent along for one payload shape).
  // No-op for the windows' point of view while a remote override is active
  // (daemonInfo returns the remote pair), but the local child stays alive.
  pushDaemonInfo()
}

/** Spawn the daemon and register its url getter + quit teardown. Called once, before the first window. */
export async function startDaemon(): Promise<void> {
  // Resolve the shared token before launching the daemon or exposing the getter —
  // ensureDaemonToken reads ~/.porcelain/daemon-token (creating it 0600 on first
  // run), so both the daemon (via env, below) and every window (via the getter)
  // agree on the same secret. Runs once, before the first window exists.
  token = await ensureDaemonToken()

  // Adopt a persisted remote override before the first window boots, so a new
  // window's preload getter returns the remote pair straight away (and boot
  // restores the remote daemon's recents). The local child still launches below.
  remoteOverride = await loadRemoteDaemon()

  // Sync getter the preload calls at window boot; restarts push updates over
  // `daemon-url-changed` (see above), so the value survives daemon crashes.
  ipcMain.on('daemon-url', (event) => {
    event.returnValue = daemonInfo()
  })
  app.on('before-quit', () => {
    quitting = true
    child?.kill()
  })
  await launch()
}
