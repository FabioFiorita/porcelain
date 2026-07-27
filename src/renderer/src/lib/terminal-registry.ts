import '@xterm/xterm/css/xterm.css'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useTerminalInputStore } from '@renderer/stores/terminal-input'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { type ITheme, Terminal } from '@xterm/xterm'
import { sessionForTerminal } from './local-daemon'
import { isCoarseTouch, isE2E } from './platform'
import {
  type ArrowDirection,
  controlByte,
  terminalArrowBytes,
  terminalEditBytes,
} from './terminal-keys'
import { attachOsc52Clipboard } from './terminal-osc52'
import { attachTouchScroll } from './terminal-touch-scroll'
import { resolveTheme, subscribeResolvedTheme } from './theme'

/**
 * Apply a finger-pan line delta to an xterm instance. Normal buffer → scrollback via
 * scrollLines. Alternate buffer (TUIs) has no scrollback, so scrollLines is a no-op —
 * send application/normal cursor keys the way xterm's wheel handler does for no-scrollback
 * buffers, so Claude Code / vim actually move.
 */
function scrollTerminalTouch(term: Terminal, lines: number): void {
  if (lines === 0) return
  term.scrollLines(lines)
  if (term.buffer.active.type !== 'alternate') return
  // xterm wheel fallback: deltaY < 0 → CSI A (up), deltaY > 0 → CSI B (down).
  // Our lines: negative = older = finger-down ≈ content moves down ≈ deltaY < 0 → A.
  const key = lines < 0 ? 'A' : 'B'
  const prefix = term.modes.applicationCursorKeysMode ? '\x1bO' : '\x1b['
  const seq = `${prefix}${key}`
  const n = Math.abs(lines)
  for (let i = 0; i < n; i++) {
    // wasUserInput=false: don't clear selection / steal focus as a real key would.
    term.input(seq, false)
  }
}

/**
 * The xterm palette per resolved appearance — the single JS source of truth for
 * the terminal background (terminal-view reads `.background` for its pane fill).
 * Dark is byte-identical to the old inline literal (solid graphite in the spirit
 * of the app's neutral surfaces); light is a readable GitHub-Light-style palette
 * on a near-white ground with dark-enough ANSI colors to stay legible.
 */
export const TERMINAL_THEMES: Record<'light' | 'dark', ITheme> = {
  dark: {
    background: '#16161a',
    foreground: '#e4e4e7',
    cursor: '#e4e4e7',
    selectionBackground: '#3f3f46',
  },
  light: {
    background: '#ffffff',
    foreground: '#1f2328',
    cursor: '#1f2328',
    selectionBackground: '#b4d4ff',
    black: '#24292e',
    red: '#cf222e',
    green: '#116329',
    yellow: '#7d4e00',
    blue: '#0969da',
    magenta: '#8250df',
    cyan: '#1b7c83',
    white: '#6e7781',
    brightBlack: '#57606a',
    brightRed: '#a40e26',
    brightGreen: '#1a7f37',
    brightYellow: '#633c01',
    brightBlue: '#218bff',
    brightMagenta: '#a475f9',
    brightCyan: '#3192aa',
    brightWhite: '#8c959f',
  },
}

/** Resolved appearance for new/updated terminals (both the store and the OS). */
function currentTerminalMode(): 'light' | 'dark' {
  return resolveTheme(usePreferencesStore.getState().theme)
}

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
 *
 * Paint path is one product decision: **WebGL by default** (crisp block glyphs for
 * Claude Code logos / powerline). DOM is automatic only — multi-touch devices force
 * it (WebGL contexts get killed under memory pressure), and load failure / context
 * loss degrades to DOM silently. No Settings toggle (one architecture).
 */
interface Instance {
  term: Terminal
  fit: FitAddon
  wrapper: HTMLDivElement
  /** Tear down iPad touch→scrollLines listeners (absent on desktop). */
  disposeTouchScroll?: () => void
}

/** Keys whose own keydown is a modifier press, never "the next keystroke". */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta'])

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

// Resolved-appearance change (theme preference or OS flip) → retint every live
// xterm in place. Deduped by the helper (fires only when the mode truly flips);
// new terminals read currentTerminalMode() in create().
subscribeResolvedTheme((mode) => {
  const theme = TERMINAL_THEMES[mode]
  for (const instance of instances.values()) instance.term.options.theme = theme
})

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
    // Themed to the current resolved appearance (subscribeResolvedTheme retints
    // live instances; new ones read the mode here).
    theme: TERMINAL_THEMES[currentTerminalMode()],
    scrollback: 10_000,
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  // Remote TUIs (Claude Code, vim, tmux) copy via OSC 52; without this the sequence
  // is ignored and the host clipboard never updates. Write-only — see terminal-osc52.
  attachOsc52Clipboard(term)
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

  let usesWebgl = false
  // Multi-touch devices force DOM: WebGL contexts get killed under memory pressure and
  // leave blank/garbled panes. Everywhere else prefer WebGL for edge-to-edge block glyphs
  // (Claude Code logo, powerline fills). Load is best-effort — missing WebGL or a later
  // context loss disposes the addon so xterm falls back to DOM instead of painting nothing.
  if (!isCoarseTouch()) {
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => webgl.dispose())
      term.loadAddon(webgl)
      usesWebgl = true
    } catch {
      // No WebGL context available — stay on the DOM renderer.
    }
  }

  // xterm 6 scrolls via SmoothScrollableElement (wheel only) — iOS Safari never fires
  // wheel for finger pans. Convert vertical pans into line steps. On the NORMAL buffer
  // that's term.scrollLines; on the ALTERNATE buffer (Claude Code / vim fullscreen)
  // scrollLines is a no-op (no scrollback), so we also feed cursor-up/down like xterm's
  // own wheel fallback — otherwise a remote Claude session looks frozen to touch.
  const disposeTouchScroll = isCoarseTouch()
    ? attachTouchScroll(
        (lines) => scrollTerminalTouch(term, lines),
        () => {
          const el = term.element
          if (el && term.rows > 0) {
            const h = el.clientHeight / term.rows
            if (h > 0) return h
          }
          return (term.options.fontSize ?? 12) * (term.options.lineHeight ?? 1)
        },
        wrapper,
      )
    : undefined
  // Keystrokes and fit-driven resizes flow back to this session's PTY over the
  // daemon WS session (lib/daemon.ts).
  term.onData((data) => sessionForTerminal(id).writeTerminal(id, data))
  term.onResize(({ cols, rows }) => sessionForTerminal(id).resizeTerminal(id, cols, rows))
  // macOS editing chords xterm doesn't send on its own. We `preventDefault()` + return
  // false to fully own the key. The preventDefault is LOAD-BEARING for ⏎-based chords:
  // xterm's keydown path bails on a `false` return WITHOUT calling preventDefault, so the
  // browser still fires a `keypress` for Enter and xterm's `_keyPress` sends a bare `\r`
  // (charCode 13) on its own — our ⇧↵ `ESC CR` would then be followed by that stray `\r`,
  // i.e. newline-then-SUBMIT. (Backspace/arrows never fire keypress, which is why only the
  // Enter chords were broken.) preventDefault cancels the keypress, so only our bytes go.
  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown') return true
    // A modifier's own keydown is not "the next keystroke" — pressing Shift to type an
    // uppercase letter must not consume an armed Ctrl before the letter arrives.
    if (MODIFIER_KEYS.has(event.key)) return true
    // Sticky Ctrl from the key bar (a soft keyboard has no Ctrl): the armed session turns
    // its next keystroke into a control byte. Disarms on ANY key, so a non-chord key
    // (Enter, an arrow) cancels rather than staying armed for something later.
    const input = useTerminalInputStore.getState()
    if (input.pendingCtrlId === id) {
      input.clearCtrl()
      const ctrlBytes = controlByte(event.key)
      if (ctrlBytes !== null) {
        event.preventDefault()
        sessionForTerminal(id).writeTerminal(id, ctrlBytes)
        return false
      }
    }
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
      sessionForTerminal(id).writeTerminal(id, bytes)
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
  // Focus is DELIBERATELY skipped on touch: focusing xterm's hidden textarea is what raises
  // the iOS software keyboard, and this runs on every mount — opening a terminal tab,
  // switching tabs, moving a terminal between panes — so an iPad could never just *read*
  // scrollback without the keyboard eating half the pane. `TerminalView` focuses only on
  // a real tap (not a scroll pan), and the touch key bar has an explicit Keyboard button.
  if (!isCoarseTouch()) instance.term.focus()
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

/** Drop focus (on touch this is what dismisses the software keyboard). */
export function blurTerminal(id: string): void {
  instances.get(id)?.term.blur()
}

/**
 * Whether this session's xterm currently holds focus — i.e. whether the software keyboard
 * is up. The key bar's Keyboard button reads it at click time to decide show-vs-dismiss;
 * xterm's focus lives on its hidden helper textarea, not the wrapper.
 */
export function isTerminalFocused(id: string): boolean {
  const wrapper = instances.get(id)?.wrapper
  if (!wrapper) return false
  const helper = wrapper.querySelector('.xterm-helper-textarea')
  return helper !== null && document.activeElement === helper
}

/** Current selection text, or '' when empty / no instance. */
export function getTerminalSelection(id: string): string {
  return instances.get(id)?.term.getSelection() ?? ''
}

export function clearTerminalSelection(id: string): void {
  instances.get(id)?.term.clearSelection()
}

/**
 * Subscribe to selection changes. Returns null when the xterm instance isn't up yet
 * (common: child toolbar effect runs before TerminalView's attach effect) — callers
 * should retry. Dispose stops the listener.
 */
export function subscribeTerminalSelection(id: string, cb: () => void): (() => void) | null {
  const term = instances.get(id)?.term
  if (!term) return null
  const disposable = term.onSelectionChange(cb)
  return () => disposable.dispose()
}

/**
 * Pixel position for a selection Copy chip, relative to the terminal *host*
 * (the container that wraps the xterm element — includes its padding). Placed just
 * above the selection start, or below if there isn't room. Null when empty / gone.
 */
export function getTerminalSelectionAnchor(
  id: string,
): { left: number; top: number; text: string } | null {
  const instance = instances.get(id)
  if (!instance) return null
  const { term, wrapper } = instance
  const text = term.getSelection()
  if (text === '') return null
  const range = term.getSelectionPosition()
  const el = term.element
  // Host is the React container we attach into (padding lives there).
  const host = wrapper.parentElement
  if (!range || !el || !host) return null

  const cols = Math.max(term.cols, 1)
  const rows = Math.max(term.rows, 1)
  const cellW = el.clientWidth / cols
  const cellH = el.clientHeight / rows
  // xterm documents buffer coords as 1-based.
  const col = Math.max(0, range.start.x - 1)
  const row = range.start.y - 1 - term.buffer.active.viewportY

  const hostRect = host.getBoundingClientRect()
  const termRect = el.getBoundingClientRect()
  const originLeft = termRect.left - hostRect.left
  const originTop = termRect.top - hostRect.top

  const chipH = 36
  const chipW = 88
  let left = originLeft + col * cellW
  let top = originTop + row * cellH - chipH - 4
  if (top < originTop + 4) top = originTop + Math.max(4, (row + 1) * cellH + 4)
  // Keep the chip inside the host so overflow-hidden on the pane doesn't clip it.
  left = Math.max(4, Math.min(left, host.clientWidth - chipW - 4))
  top = Math.max(4, Math.min(top, host.clientHeight - chipH - 4))

  return { left, top, text }
}

/**
 * Write bytes to the PTY as if typed — the key bar's path for keys a soft keyboard can't
 * send. Deliberately NOT `term.input()`: these bytes must reach the shell exactly as
 * composed (the same door `attachCustomKeyEventHandler` uses). Scrolls to the prompt like
 * a real keypress does, so a key tapped after scrolling back up doesn't type off-screen.
 */
export function sendTerminalInput(id: string, data: string): void {
  sessionForTerminal(id).writeTerminal(id, data)
  instances.get(id)?.term.scrollToBottom()
}

/**
 * Send an arrow key, honoring the terminal's live DECCKM state — a full-screen TUI (vim,
 * less) puts the terminal in application-cursor mode, where the normal `ESC [ A` form is
 * inserted as literal text instead of moving the cursor.
 */
export function sendTerminalArrow(id: string, direction: ArrowDirection): void {
  const instance = instances.get(id)
  if (!instance) return
  sendTerminalInput(
    id,
    terminalArrowBytes(direction, instance.term.modes.applicationCursorKeysMode),
  )
}

// Test-only: the WebGL renderer paints glyphs to a canvas and never fills `.xterm-rows`,
// so e2e can't scrape the DOM for terminal output. xterm's buffer model is maintained
// independently of the renderer, so we serialize THAT instead. Installed on `window`
// only under the e2e harness; `index` is creation order (Map insertion = `.first()`/
// `.last()` pane order in the specs).
if (isE2E) {
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
  // Marketing shots only: a 12px cell looks oversized when the full window is
  // published Retina-wide. Shrink + re-fit so git log -p fills more rows.
  window.__porcelainSetTerminalFontSize = (size: number): void => {
    for (const instance of instances.values()) {
      instance.term.options.fontSize = size
      instance.fit.fit()
      // Force a full buffer repaint (WebGL atlas + alternate-screen pagers).
      instance.term.refresh(0, Math.max(0, instance.term.rows - 1))
      instance.term.clearTextureAtlas()
    }
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
