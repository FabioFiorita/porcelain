import '@xterm/xterm/css/xterm.css'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import { resizeTerminal, writeTerminal } from './daemon'
import { terminalEditBytes } from './terminal-keys'
import { attachTouchScroll } from './terminal-touch-scroll'

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
  /** Tear down iPad touch→scrollLines listeners (absent on desktop). */
  disposeTouchScroll?: () => void
}

const instances = new Map<string, Instance>()
const buffers = new Map<string, string[]>()
// Ids whose replay scrollback has already been seeded into their xterm (or buffered for
// it). A fresh reload seeds once when the view first attaches; a later live reconnect
// re-attaches the same id but must NOT re-write the scrollback — the xterm already holds
// the full stream, and the live feed just resumes. Cleared on dispose (the session is
// gone) so a future same-id session would seed cleanly.
const seeded = new Set<string>()

// Display sleep/wake (and GPU context eviction) can lose the WebGL texture atlas without
// firing onContextLoss, leaving terminals painting smeared/wrong-color cells when the
// window comes back. No resize accompanies it, so the fit-time clear never runs — clear
// every instance's atlas on the visibility transition instead. No-op on the DOM renderer.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return
  for (const instance of instances.values()) instance.term.clearTextureAtlas()
})

// The iPad software keyboard resizes the visual viewport WITHOUT resizing any pane element,
// so the pane ResizeObserver in terminal-view never fires and cols/rows keep tracking the
// full-height area behind the keyboard. Refit every instance on a visual-viewport resize,
// debounced like that observer (100ms). visualViewport is absent outside Safari/Chrome
// (and in the test env) — guard for it.
if (typeof window !== 'undefined' && window.visualViewport) {
  let pending: ReturnType<typeof setTimeout> | undefined
  window.visualViewport.addEventListener('resize', () => {
    if (pending !== undefined) clearTimeout(pending)
    pending = setTimeout(() => {
      for (const id of instances.keys()) fitTerminal(id)
    }, 100)
  })
}

// The terminal faces load via font-display: swap, so term.open() can measure fallback-font
// cell metrics before Geist Mono swaps in — glyphs then paint at a different advance width
// inside stale cells (floating/misaligned on the DOM renderer, tofu in the WebGL atlas). Load
// both faces explicitly, then re-measure against the real metrics: the WebGL renderer re-
// rasterizes its offscreen atlas (clearTextureAtlas), while the DOM renderer caches char size
// in its CharSizeService — reassigning fontFamily to its current value is the only public lever
// that invalidates that cache, so follow it with a refit. Runs again on document.fonts.ready
// because the swap can land after our explicit load resolves. document.fonts is absent in the
// test env — skip the guard there.
function remeasureFonts(instance: Instance, usesWebgl: boolean): void {
  if (typeof document === 'undefined' || !document.fonts) return
  const apply = (): void => {
    if (usesWebgl) {
      instance.term.clearTextureAtlas()
      return
    }
    const { fontFamily } = instance.term.options
    instance.term.options.fontFamily = fontFamily
    instance.fit.fit()
  }
  Promise.all([
    document.fonts.load('12px "Geist Mono Variable"'),
    document.fonts.load('12px "Symbols Nerd Font Mono"'),
  ])
    .then(apply)
    .catch(() => {})
  document.fonts.ready.then(apply).catch(() => {})
}

/** Route inbound PTY output to its xterm, buffering until the instance is mounted. */
export function receiveData(id: string, data: string): void {
  // Live output means this id's xterm is being built from the stream itself — mark it
  // seeded so a later reconnect's scrollback replay (receiveScrollback) is ignored and
  // can't duplicate content the terminal already shows.
  seeded.add(id)
  const instance = instances.get(id)
  if (instance) {
    instance.term.write(data)
    return
  }
  const buffer = buffers.get(id) ?? []
  buffer.push(data)
  buffers.set(id, buffer)
}

/**
 * Replay a re-attached session's scrollback into its xterm (buffering until the instance
 * mounts, like receiveData). Seeds at most once per session: the first attach after a
 * fresh reload writes it, but a later live reconnect's re-attach is ignored so the xterm
 * — which already holds the full stream — isn't duplicated. An 'exited' session replays
 * its final output the same way; the roster shows the exited state separately.
 */
export function receiveScrollback(id: string, scrollback: string): void {
  if (seeded.has(id)) return
  seeded.add(id)
  if (scrollback === '') return
  receiveData(id, scrollback)
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
  // iOS soft keyboard mangles shell input (autocapitalizes the first char, autocorrects
  // command names, injects predictive-text substitutions) via xterm's hidden helper
  // textarea. xterm already sets autocorrect/autocapitalize/spellcheck, but not autocomplete;
  // set all four defensively (idempotent, self-documenting). Inert on desktop.
  const helper = wrapper.querySelector('.xterm-helper-textarea')
  if (helper) {
    helper.setAttribute('autocapitalize', 'off')
    helper.setAttribute('autocorrect', 'off')
    helper.setAttribute('autocomplete', 'off')
    helper.setAttribute('spellcheck', 'false')
  }
  // Multi-touch Apple devices (iPad/iPhone Safari) evict WebGL contexts per-page under memory
  // pressure, and each terminal session owns one — so a blanked/garbled terminal is the norm
  // there. Take the DOM renderer instead: slower and it can't paint block-element art
  // edge-to-edge, but it never blanks. Desktop Electron (maxTouchPoints 0) always takes the
  // WebGL path below.
  const coarseTouch = navigator.maxTouchPoints > 1
  let usesWebgl = false
  if (!coarseTouch) {
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
      usesWebgl = true
    } catch {
      // No WebGL context available — stay on the DOM renderer.
    }
  }
  // xterm 6 scrolls via SmoothScrollableElement, which only listens for wheel events —
  // iOS Safari never fires those for finger pans, so the page steals the gesture. Convert
  // vertical touch pans into scrollLines and preventDefault so the browser client can't
  // rubber-band the shell. Desktop keeps the wheel path (no listeners attached).
  const disposeTouchScroll = coarseTouch
    ? attachTouchScroll(
        (lines) => term.scrollLines(lines),
        () => (term.options.fontSize ?? 12) * (term.options.lineHeight ?? 1),
        wrapper,
      )
    : undefined
  // Keystrokes and fit-driven resizes flow back to this session's PTY over the
  // daemon WS session (lib/daemon.ts).
  term.onData((data) => writeTerminal(id, data))
  term.onResize(({ cols, rows }) => resizeTerminal(id, cols, rows))
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
      writeTerminal(id, bytes)
      return false
    }
    return true
  })

  const instance: Instance = { term, fit, wrapper, disposeTouchScroll }
  instances.set(id, instance)
  const buffered = buffers.get(id)
  if (buffered) {
    for (const data of buffered) term.write(data)
    buffers.delete(id)
  }
  // open() above measured cell metrics synchronously against whatever face was ready; re-
  // measure once the real terminal faces have loaded (see remeasureFonts).
  remeasureFonts(instance, usesWebgl)
  return instance
}

/** Re-parent the session's terminal into `container`, size it, and focus it. */
export function attachTerminal(id: string, container: HTMLElement): void {
  const instance = instances.get(id) ?? create(id)
  container.appendChild(instance.wrapper)
  // The wrapper now has layout — fit measures it and onResize tells the PTY.
  instance.fit.fit()
  // Re-parenting on a tab switch can leave the WebGL atlas painting stale cells; clear it
  // so the re-shown terminal re-rasterizes cleanly.
  instance.term.clearTextureAtlas()
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
  const instance = instances.get(id)
  if (!instance) return
  instance.fit.fit()
  // A resize re-lays-out the cell grid; the WebGL texture atlas can desync from the new
  // geometry and blit glyphs from stale coordinates (sliced/smeared text, wrong-color
  // cells). Clear it so glyphs re-rasterize cleanly against the current grid. No-op on the
  // DOM renderer.
  instance.term.clearTextureAtlas()
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
  instance.disposeTouchScroll?.()
  instance.term.dispose()
  instance.wrapper.remove()
  instances.delete(id)
  buffers.delete(id)
  seeded.delete(id)
}
