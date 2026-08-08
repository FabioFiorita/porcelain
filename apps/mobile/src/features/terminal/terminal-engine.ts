import type { Terminal } from '@xterm/headless'
import { copyText } from '@/lib/clipboard'
import { resizeTerminal, writeTerminal } from '@/lib/daemon/terminal'
import { NativeTerminalBuffer } from './native-terminal-buffer'
import { attachOsc52Clipboard } from './terminal-osc52'
import { loadTerminalEngine } from './xterm-host'

/**
 * Module-level home for the VT emulators — one per PTY, outliving every React tree.
 *
 * A terminal cannot live in component state. The viewer mounts only the session on screen, so
 * state would destroy the emulator on every tab switch: scrollback gone, and the background
 * dev server you switched away from writing into nothing. Instances therefore live here and
 * are torn down only when the session itself closes.
 *
 * Output that arrives before an emulator exists is buffered rather than dropped: the daemon
 * starts streaming the moment we attach, which is before any view has asked for this session.
 *
 * Repaints are throttled, not immediate: `npm install` can emit hundreds of writes a second,
 * and each one would otherwise be a React render. The revision counter is what views
 * subscribe to, and it advances at most once per frame budget.
 */

/** ~30fps. Below this the pane reads as laggy; above it a noisy build starves the UI thread. */
const REPAINT_MS = 33

/** Matches the desktop client, so the same PTY offers the same history on both. */
const SCROLLBACK_LINES = 10_000

/**
 * The native Ghostty surface receives a replayable stream, rather than an xterm cell dump.
 * Keep that bridge explicitly bounded: a mobile client can be attached to a noisy PTY for days,
 * and retaining the entire raw stream in JavaScript would duplicate the daemon's scrollback.
 *
 * This is code units rather than bytes because the WS protocol has already decoded UTF-8 into a
 * JavaScript string. It is deliberately below the daemon's 10k-line history in the common case;
 * when it rolls over the native surface rebuilds from the retained tail, just as it does after a
 * reconnect whose daemon scrollback was pruned.
 */
type Instance = {
  term: Terminal
  repaintTimer: ReturnType<typeof setTimeout> | undefined
}

const instances = new Map<string, Instance>()
/** Bumped on every visible change; the viewer's `useSyncExternalStore` snapshot. */
const revisions = new Map<string, number>()
const pending = new Map<string, string[]>()
/** Bounded raw stream supplied to the native Ghostty surface. */
const nativeBuffers = new Map<string, NativeTerminalBuffer>()
const listeners = new Map<string, Set<() => void>>()
/**
 * Why this session has no emulator. The engine is loaded on first use, so a failure there
 * would otherwise be a permanently blank pane with nothing to explain it — and the PTY on the
 * other side is running fine, which makes a silent blank especially misleading.
 */
const failures = new Map<string, string>()
/** The grid the pane last measured, applied as soon as an emulator exists for it. */
const sizes = new Map<string, { cols: number; rows: number }>()
/**
 * The most recent grid ANY pane measured — the size a PTY that has no view yet should be
 * spawned at. Without it every new terminal starts at the daemon's 80×24 and a TUI draws its
 * first frame against a grid this device never had.
 */
let lastMeasured: { cols: number; rows: number } | undefined
/**
 * Sessions whose replay snapshot is still being parsed. A replay re-runs every escape sequence
 * in the scrollback, and on this client that happens on EVERY reconnect — backgrounding the app
 * is one. An OSC 52 copy from an hour ago must not take the pasteboard again each time.
 */
const replaying = new Set<string>()
/**
 * Ids whose replay scrollback has already been written. A fresh launch seeds once; a later
 * reconnect re-attaches the same id and must NOT seed again — the emulator already holds the
 * whole stream, and a second copy would print the session twice.
 */
const seeded = new Set<string>()

function notify(id: string): void {
  // The revision lives outside the instance so a session with no emulator yet — still loading,
  // or failed to load — can still tell its view that something changed.
  revisions.set(id, (revisions.get(id) ?? 0) + 1)
  for (const listener of listeners.get(id) ?? []) listener()
}

/** Coalesce a burst of PTY writes into one repaint. */
function scheduleRepaint(id: string): void {
  const instance = instances.get(id)
  if (instance === undefined || instance.repaintTimer !== undefined) return
  instance.repaintTimer = setTimeout(() => {
    const current = instances.get(id)
    if (current === undefined) return
    current.repaintTimer = undefined
    notify(id)
  }, REPAINT_MS)
}

function appendNativeData(id: string, data: string): void {
  if (data === '') return
  const buffer = nativeBuffers.get(id) ?? new NativeTerminalBuffer()
  buffer.append(data)
  nativeBuffers.set(id, buffer)
}

function replaceNativeData(id: string, data: string): void {
  const buffer = nativeBuffers.get(id) ?? new NativeTerminalBuffer()
  buffer.replace(data)
  nativeBuffers.set(id, buffer)
}

/**
 * The current bounded PTY stream for Ghostty. Joining is intentionally done only by the
 * throttled React paint path, never for each WebSocket frame.
 */
export function terminalNativeBuffer(id: string): string {
  return nativeBuffers.get(id)?.value() ?? ''
}

/** Ensure this session has an emulator. Safe to call on every mount. */
export function ensureTerminal(id: string): void {
  if (instances.has(id)) return
  try {
    const TerminalCtor = loadTerminalEngine()
    const term = new TerminalCtor({ allowProposedApi: true, scrollback: SCROLLBACK_LINES })
    instances.set(id, { repaintTimer: undefined, term })
    failures.delete(id)
    // The pane may already have measured itself; adopt that grid before writing anything into
    // the emulator, so buffered output wraps at the width it will actually be read at.
    const measured = sizes.get(id)
    if (measured !== undefined) fitTerminal(id, measured.cols, measured.rows)

    // The emulator answers the PTY on its own for device-status and cursor-position reports
    // (`ESC [ 6 n` and friends). Those replies are input, so they go back over the wire — a TUI
    // that asks and never hears back hangs waiting.
    term.onData((data: string) => {
      writeTerminal(id, data)
    })

    // Agents, vim and tmux copy by emitting OSC 52 — xterm does not handle it, so without this
    // a copy inside the shell silently reaches nothing while the agent reports success.
    // Write-only: a clipboard READ would report this device's pasteboard into the PTY.
    attachOsc52Clipboard(term, (text: string) => {
      if (replaying.has(id)) return
      // Fire-and-forget: an OSC handler cannot await, and `copyText` reports failure by
      // resolving false rather than rejecting.
      copyText(text)
    })

    const queued = pending.get(id)
    pending.delete(id)
    if (queued !== undefined) for (const chunk of queued) term.write(chunk)
    notify(id)
  } catch (cause) {
    // The engine failed to load or construct. The PTY on the other side is running fine, so a
    // silent blank pane would be actively misleading — record why.
    failures.set(id, cause instanceof Error ? cause.message : String(cause))
    notify(id)
  }
}

/** Why this session shows nothing, when it shows nothing. */
export function terminalFailure(id: string): string | undefined {
  return failures.get(id)
}

/** Route inbound PTY output to its emulator, buffering until one exists. */
export function receiveData(id: string, data: string): void {
  // Live output means this session is being rebuilt from the stream itself — mark it seeded so
  // a later reconnect's replay cannot duplicate what is already on screen.
  seeded.add(id)
  appendNativeData(id, data)
  // Ghostty consumes the raw stream directly and must not wait for the compatibility xterm
  // parser's async write callback. A busy prompt can queue many parser writes; withholding the
  // revision until that queue drains makes native pixels appear frozen despite having the bytes.
  scheduleRepaint(id)
  const instance = instances.get(id)
  if (instance === undefined) {
    pending.set(id, [...(pending.get(id) ?? []), data])
    ensureTerminal(id)
    scheduleRepaint(id)
    return
  }
  instance.term.write(data, () => {
    scheduleRepaint(id)
  })
}

/**
 * Replay a re-attached session's scrollback. The daemon's snapshot is authoritative after a
 * reconnect: the emulator may have missed output while the socket was down, so an already-seeded
 * session must be reset before the snapshot is written again rather than silently dropping it.
 */
export function receiveScrollback(id: string, scrollback: string): void {
  const wasSeeded = seeded.has(id)
  // The daemon snapshot is authoritative after reconnect. Replace, never append: a missed
  // reconnect otherwise makes Ghostty render the same replay twice even when xterm is reset.
  replaceNativeData(id, scrollback)
  // Written straight into the emulator rather than through `receiveData`, because the replay
  // has to be marked as a replay for the whole time xterm spends parsing it — see `replaying`.
  ensureTerminal(id)
  seeded.add(id)
  const instance = instances.get(id)
  if (instance === undefined) {
    // The engine failed to load. The replay supersedes anything buffered for the older stream.
    pending.delete(id)
    return
  }
  if (wasSeeded) instance.term.reset()
  if (scrollback === '') {
    if (wasSeeded) notify(id)
    return
  }
  replaying.add(id)
  instance.term.write(scrollback, () => {
    replaying.delete(id)
    scheduleRepaint(id)
  })
}

/** A dim footer when the PTY ends, so an exited session still reads as finished. */
export function receiveExit(id: string, exitCode: number): void {
  receiveData(id, `\r\n\x1b[2m[process exited${exitCode ? ` (${exitCode})` : ''}]\x1b[0m\r\n`)
}

export function subscribeTerminal(id: string, listener: () => void): () => void {
  const set = listeners.get(id) ?? new Set<() => void>()
  set.add(listener)
  listeners.set(id, set)
  return () => {
    set.delete(listener)
    if (set.size === 0) listeners.delete(id)
  }
}

/** The snapshot `useSyncExternalStore` compares. */
export function terminalRevision(id: string): number {
  return revisions.get(id) ?? 0
}

export function getTerminal(id: string): Terminal | undefined {
  return instances.get(id)?.term
}

/**
 * Resize the grid and tell the PTY. Skipped when nothing changed: every resize is a SIGWINCH,
 * and shells like p10k reprint their prompt for each one — a storm of them stacks copies up the
 * scrollback.
 *
 * The size is remembered even when there is no emulator yet, because the pane measures itself
 * long before the engine finishes loading; without that, a session would keep the default 80×24
 * against a phone-width pane and wrap every prompt in the wrong place.
 */
export function fitTerminal(id: string, cols: number, rows: number): void {
  if (cols <= 0 || rows <= 0) return
  sizes.set(id, { cols, rows })
  lastMeasured = { cols, rows }
  const instance = instances.get(id)
  if (instance === undefined) return
  if (instance.term.cols === cols && instance.term.rows === rows) return
  instance.term.resize(cols, rows)
  resizeTerminal(id, cols, rows)
  notify(id)
}

/**
 * The grid to spawn the NEXT PTY at — the last one a pane measured on this device.
 *
 * A create carries `cols`/`rows` on the wire, and a shell that starts at the right size draws
 * its first frame at the right size. Without it a TUI paints against the daemon's 80×24 and is
 * corrected only once a view has mounted and measured, which is a visible reflow — and on a
 * phone, an 80-column first frame wraps every line of it.
 */
export function nextTerminalSize(): { cols: number; rows: number } | undefined {
  return lastMeasured
}

/** Scroll the emulator's viewport by whole lines (negative = older). */
export function scrollTerminal(id: string, lines: number): void {
  const instance = instances.get(id)
  if (instance === undefined || lines === 0) return
  instance.term.scrollLines(lines)
  notify(id)
}

export function scrollTerminalToBottom(id: string): void {
  const instance = instances.get(id)
  if (instance === undefined) return
  instance.term.scrollToBottom()
  notify(id)
}

/** Tear the emulator down for good — the session is closing. */
export function disposeTerminal(id: string): void {
  const instance = instances.get(id)
  pending.delete(id)
  nativeBuffers.delete(id)
  seeded.delete(id)
  failures.delete(id)
  sizes.delete(id)
  replaying.delete(id)
  if (instance === undefined) return
  if (instance.repaintTimer !== undefined) clearTimeout(instance.repaintTimer)
  instance.term.dispose()
  instances.delete(id)
  notify(id)
  listeners.delete(id)
  revisions.delete(id)
}
