import { isBrowser, isLinuxShell } from './platform'

/**
 * The primary shortcut modifier is Ctrl, not Cmd. True for the browser client
 * Safari (macOS and iPad) and Chrome reserve most Command-key chords the app
 * binds — ⌘1–9 (tab switch), ⌘T (new tab), ⌘N (new window), ⌘W (close), ⌘P (print) — so
 * the browser either steals them or opens its own chrome. Ctrl chords, by contrast, ARE
 * interceptable in the page (that's the point of the remap), so the browser client keys
 * every primary-mod shortcut off Ctrl and always `preventDefault()`s. In the Electron
 * shell (native window, no such collisions) the primary mod stays Cmd.
 *
 * The OS may still be macOS here (iPad/Mac Safari) — the trigger is the browser client,
 * not the platform. The Linux Electron shell (`isLinuxShell`) is the third case: a native
 * window with no browser collisions, but a Linux keyboard where Ctrl is the primary mod —
 * so it joins the browser client on Ctrl. Under vitest/jsdom `isBrowser` is `true` (no
 * preload bridge) and `isLinuxShell` is `false`, so the browser behaviour is the unit-test
 * baseline; the label/predicate helpers are exercised for BOTH modes via their `mac`/`ctrl`
 * params, so the default doesn't skew coverage.
 */
export const ctrlIsPrimary: boolean = isBrowser || isLinuxShell

/**
 * True when a keystroke landed in a real text field we shouldn't hijack with an app
 * shortcut (a card title, the commit box, the rename input). The terminal is the
 * deliberate exception: the terminal's hidden textarea reports as editable, but ⌘T / ⌘N must
 * still spawn a terminal while it's focused, so anything inside its host is excluded.
 */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.closest('.porcelain-ghostty-terminal')) return false
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
}

/**
 * True when the keystroke landed inside the embedded terminal. The inverse of
 * the host carve-out above: the spawn shortcuts (⌘T/⌘N) WANT to fire over a focused
 * PTY, but the destructive Files shortcuts (⌘D/⌘⌫) must NOT — a ⌘⌫ meant to delete a
 * shell line should never trash a file.
 */
export function isTerminalTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('.porcelain-ghostty-terminal') !== null
}

// A keyboard event, narrowed to just the two primary-modifier flags — so the predicate
// below is pure and unit-testable with a plain object, no synthetic KeyboardEvent.
type ModEvent = { metaKey: boolean; ctrlKey: boolean }

/**
 * True when the primary modifier is down and the OTHER one isn't — for shortcuts that
 * must not double-fire on the wrong modifier (tab switch ⌘1–7, split ⌘⇧S). Loose
 * `e.metaKey || e.ctrlKey` checks elsewhere already accept Ctrl and don't need this.
 * `ctrlPrimary` is a param (not read from the live mode) so this stays unit-testable
 * without stubbing the bridge; in shell mode it's identical to `e.metaKey && !e.ctrlKey`.
 */
export function isModExclusive(e: ModEvent, ctrlPrimary: boolean = ctrlIsPrimary): boolean {
  return ctrlPrimary ? e.ctrlKey && !e.metaKey : e.metaKey && !e.ctrlKey
}

/**
 * The pure token→label mapping behind `kbdLabel` (split out for per-mode testing). Tokens
 * 'mod'/'alt'/'shift' map to the mode's label; anything else (a letter, ⌫, ↵, ←) passes
 * through. Electron/macOS: ⌘/⌥/⇧. Browser client and Linux shell: words Ctrl/Alt/Shift —
 * the browser remaps primary chords onto Ctrl even on macOS, so a glyph keyboard would lie.
 * `linux` implies `ctrlPrimary` and wins when both are set.
 */
export function formatKbdParts(
  tokens: readonly string[],
  ctrlPrimary: boolean,
  linux: boolean = false,
): string[] {
  const labels: Record<string, string> =
    linux || ctrlPrimary
      ? { mod: 'Ctrl', alt: 'Alt', shift: 'Shift' }
      : { mod: '⌘', alt: '⌥', shift: '⇧' }
  return tokens.map((token) => labels[token] ?? token)
}

export function formatKbd(tokens: string[], ctrlPrimary: boolean, linux: boolean = false): string {
  const parts = formatKbdParts(tokens, ctrlPrimary, linux)
  return linux || ctrlPrimary ? parts.join('+') : parts.join('')
}

/**
 * Render a shortcut for a <Kbd> chip, tooltip, or hint string, in the live mode. Thin
 * wrapper over `formatKbd`; the callers stay `kbdLabel('mod', 'B')` as in the shell.
 */
export function kbdLabel(...tokens: string[]): string {
  return formatKbd(tokens, ctrlIsPrimary, isLinuxShell)
}

/** One label per key, for Linear-style split keycaps. */
export function kbdParts(...tokens: string[]): string[] {
  return formatKbdParts(tokens, ctrlIsPrimary, isLinuxShell)
}
