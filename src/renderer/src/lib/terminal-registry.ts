import '@xterm/xterm/css/xterm.css'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import { terminalEditBytes } from './terminal-keys'

/**
 * The renderer-side home for xterm.js instances. A terminal must outlive its React
 * view: the viewer only mounts the ACTIVE tab, so switching away from (or closing)
 * a terminal tab unmounts its component — but the PTY keeps running (a background
 * dev server) and its scrollback must survive. So each session's `Terminal` lives
 * here in a module-level registry, opened into a detached wrapper element the view
 * merely re-parents on mount; nothing is disposed until the session is truly closed.
 *
 * The dedicated terminal bridge is routed in by `useTerminalChannel` (mounted once in
 * AppShell, like `useAppEvents`): PTY output → `receiveData` writes the matching xterm
 * (buffered until the instance exists, so nothing is lost in the gap between spawn and
 * first mount), and an exit → `receiveExit` writes a dim footer line. Keystrokes and
 * fit-driven resizes flow back out per instance.
 */
interface Instance {
  term: Terminal
  fit: FitAddon
  wrapper: HTMLDivElement
}

const instances = new Map<string, Instance>()
const buffers = new Map<string, string[]>()

/** Route inbound PTY output to its xterm, buffering until the instance is mounted. */
export function receiveData(id: string, data: string): void {
  const instance = instances.get(id)
  if (instance) {
    instance.term.write(data)
    return
  }
  const buffer = buffers.get(id) ?? []
  buffer.push(data)
  buffers.set(id, buffer)
}

/** Write a dim footer line when a session's PTY exits. */
export function receiveExit(id: string, exitCode: number): void {
  const footer = `\r\n\x1b[2m[process exited${exitCode ? ` (${exitCode})` : ''}]\x1b[0m\r\n`
  const instance = instances.get(id)
  if (instance) instance.term.write(footer)
  else buffers.set(id, [...(buffers.get(id) ?? []), footer])
}

function create(id: string): Instance {
  const term = new Terminal({
    // Geist Mono renders text; "Symbols Nerd Font Mono" is the per-glyph fallback so
    // powerline/devicon prompt glyphs render instead of tofu (see main.css @font-face).
    fontFamily:
      '"Geist Mono Variable", "Symbols Nerd Font Mono", ui-monospace, SFMono-Regular, monospace',
    fontSize: 12,
    // 1.0 keeps the cell box flush with the glyph row: the WebGL renderer's customGlyphs
    // draw block-element art (the Claude Code logo, powerline fills) edge-to-edge, but any
    // extra leading would still reintroduce the horizontal gaps between block rows.
    lineHeight: 1.0,
    cursorBlink: true,
    // Solid graphite, in the spirit of the app's neutral dark surfaces.
    theme: {
      background: '#16161a',
      foreground: '#e4e4e7',
      cursor: '#e4e4e7',
      selectionBackground: '#3f3f46',
    },
    scrollback: 10_000,
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  const wrapper = document.createElement('div')
  wrapper.style.height = '100%'
  wrapper.style.width = '100%'
  term.open(wrapper)
  // GPU renderer: its customGlyphs paint box-drawing/block-element chars edge-to-edge
  // (crisp Claude Code logo + powerline fills), which the DOM renderer can't — it leaves
  // a letter-spacing gap between every block column. Glyphs are still rasterized via canvas
  // fillText, so the per-glyph Nerd Font fallback survives the switch. Best-effort: if WebGL
  // is unavailable, or its context is lost later, dispose so xterm reverts to the DOM
  // renderer (degraded block art) instead of painting nothing.
  try {
    const webgl = new WebglAddon()
    webgl.onContextLoss(() => webgl.dispose())
    term.loadAddon(webgl)
    // The WebGL atlas rasterizes glyphs in an offscreen canvas which — unlike DOM text —
    // does NOT trigger @font-face loading, so Nerd Font fallback glyphs cache as tofu. Load
    // the terminal fonts explicitly (idempotent), then clear the atlas so they re-rasterize
    // against the real faces.
    Promise.all([
      document.fonts.load('12px "Geist Mono Variable"'),
      document.fonts.load('12px "Symbols Nerd Font Mono"'),
    ])
      .then(() => term.clearTextureAtlas())
      .catch(() => {})
  } catch {
    // No WebGL context available — stay on the DOM renderer.
  }
  // Keystrokes and fit-driven resizes flow back to this session's PTY over the bridge.
  term.onData((data) => window.porcelain.terminal.write(id, data))
  term.onResize(({ cols, rows }) => window.porcelain.terminal.resize(id, cols, rows))
  // macOS editing chords xterm doesn't send on its own. We `preventDefault()` + return
  // false to fully own the key. The preventDefault is LOAD-BEARING for ⏎-based chords:
  // xterm's keydown path bails on a `false` return WITHOUT calling preventDefault, so the
  // browser still fires a `keypress` for Enter and xterm's `_keyPress` sends a bare `\r`
  // (charCode 13) on its own — our ⇧↵ `ESC CR` would then be followed by that stray `\r`,
  // i.e. newline-then-SUBMIT. (Backspace/arrows never fire keypress, which is why only the
  // Enter chords were broken.) preventDefault cancels the keypress, so only our bytes go.
  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown') return true
    // ⌘K clears the viewport (macOS terminal convention). Meta only — never Ctrl-K,
    // which is readline's kill-to-end-of-line and must still reach the shell.
    if (
      event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'k'
    ) {
      event.preventDefault()
      term.clear()
      return false
    }
    // ⌘/⌥ + arrows/backspace and ⇧↵ → the control bytes a real shell expects.
    const bytes = terminalEditBytes(event)
    if (bytes !== null) {
      event.preventDefault()
      window.porcelain.terminal.write(id, bytes)
      return false
    }
    return true
  })

  const instance: Instance = { term, fit, wrapper }
  instances.set(id, instance)
  const buffered = buffers.get(id)
  if (buffered) {
    for (const data of buffered) term.write(data)
    buffers.delete(id)
  }
  return instance
}

/** Re-parent the session's terminal into `container`, size it, and focus it. */
export function attachTerminal(id: string, container: HTMLElement): void {
  const instance = instances.get(id) ?? create(id)
  container.appendChild(instance.wrapper)
  // The wrapper now has layout — fit measures it and onResize tells the PTY.
  instance.fit.fit()
  instance.term.focus()
}

/**
 * Detach the terminal from the DOM on unmount WITHOUT disposing it (PTY lives on).
 * Container-scoped: only remove the wrapper if THIS container still owns it. When a
 * terminal moves between panes, the new pane's `attach` re-parents the wrapper before
 * the old pane unmounts — without this guard the old pane's `detach` would yank the
 * wrapper back out and blank the new pane.
 */
export function detachTerminal(id: string, container: HTMLElement): void {
  const wrapper = instances.get(id)?.wrapper
  if (wrapper && wrapper.parentElement === container) wrapper.remove()
}

export function fitTerminal(id: string): void {
  instances.get(id)?.fit.fit()
}

export function focusTerminal(id: string): void {
  instances.get(id)?.term.focus()
}

// Test-only: the WebGL renderer paints glyphs to a canvas and never fills `.xterm-rows`,
// so e2e can't scrape the DOM for terminal output. xterm's buffer model is maintained
// independently of the renderer, so we serialize THAT instead. Installed on `window`
// only under the e2e harness; `index` is creation order (Map insertion = `.first()`/
// `.last()` pane order in the specs).
if (window.porcelain?.e2e) {
  window.__porcelainTerminalText = (index: number): string => {
    const instance = [...instances.values()][index]
    if (!instance) return ''
    const buffer = instance.term.buffer.active
    const lines: string[] = []
    for (let row = 0; row < buffer.length; row++) {
      lines.push(buffer.getLine(row)?.translateToString(true) ?? '')
    }
    return lines.join('\n')
  }
}

/** Tear down the xterm instance for good — the session is closing. */
export function disposeTerminal(id: string): void {
  const instance = instances.get(id)
  if (!instance) return
  instance.term.dispose()
  instance.wrapper.remove()
  instances.delete(id)
  buffers.delete(id)
}
