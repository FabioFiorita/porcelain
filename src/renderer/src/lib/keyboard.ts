import { isBrowser } from './platform'

/**
 * The primary shortcut modifier is Ctrl, not Cmd. True for the browser client
 * (remote-envs Phase 3): Safari (macOS + iPad) and Chrome reserve most ⌘ chords the app
 * binds — ⌘1–9 (tab switch), ⌘T (new tab), ⌘N (new window), ⌘W (close), ⌘P (print) — so
 * the browser either steals them or opens its own chrome. Ctrl chords, by contrast, ARE
 * interceptable in the page (that's the point of the remap), so the browser client keys
 * every primary-mod shortcut off Ctrl and always `preventDefault()`s. In the Electron
 * shell (native window, no such collisions) the primary mod stays Cmd.
 *
 * The OS may still be macOS here (iPad/Mac Safari) — the trigger is the browser client,
 * not the platform. Under vitest/jsdom `isBrowser` is `true` (no preload bridge), so the
 * browser behaviour is the unit-test baseline; the label/predicate helpers are exercised
 * for BOTH modes via their `mac`/`ctrl` params, so the default doesn't skew coverage.
 */
export const ctrlIsPrimary = isBrowser

/**
 * True when a keystroke landed in a real text field we shouldn't hijack with an app
 * shortcut (a card title, the commit box, the rename input). The terminal is the
 * deliberate exception: xterm's hidden textarea reports as editable, but ⌘T / ⌘N must
 * still spawn a terminal while it's focused, so anything inside `.xterm` is excluded.
 */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.closest('.xterm')) return false
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
}

/**
 * True when the keystroke landed inside the embedded terminal (xterm). The inverse of
 * the `.xterm` carve-out above: the spawn shortcuts (⌘T/⌘N) WANT to fire over a focused
 * PTY, but the destructive Files shortcuts (⌘D/⌘⌫) must NOT — a ⌘⌫ meant to delete a
 * shell line should never trash a file.
 */
export function isTerminalTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('.xterm') !== null
}

// A keyboard event, narrowed to just the two primary-modifier flags — so the predicate
// below is pure and unit-testable with a plain object, no synthetic KeyboardEvent.
type ModEvent = { metaKey: boolean; ctrlKey: boolean }

/**
 * The primary modifier is down AND the foreign one (the OTHER of Cmd/Ctrl) is NOT — the
 * exclusive case where a shortcut must not fire on the wrong modifier (tab switch ⌘1–7,
 * split ⌘⇧S). Its cousin, the LOOSE `e.metaKey || e.ctrlKey` sites scattered through the
 * components, already accept Ctrl, so they fire in the browser client unchanged — only
 * the exclusive checks needed routing through here.
 *
 * `ctrlPrimary` defaults to the live mode (Ctrl in the browser client, Cmd in the Electron
 * shell) but is a param so the pure logic is testable for both modes without stubbing the
 * bridge. In shell mode it's byte-identical to the old `e.metaKey && !e.ctrlKey`.
 */
export function isModExclusive(e: ModEvent, ctrlPrimary: boolean = ctrlIsPrimary): boolean {
  return ctrlPrimary ? e.ctrlKey && !e.metaKey : e.metaKey && !e.ctrlKey
}

/**
 * The pure token→label mapping behind `kbdLabel`, split out so tests can drive both modes
 * by param. The tokens 'mod' | 'alt' | 'shift' become the mode label — ⌘/⌥/⇧ joined tight
 * in the Electron shell (⌘⇧F), or ⌃/Alt/⇧ joined with '+' in the browser client (⌃+⇧+F,
 * since Safari/Chrome own ⌘). Any other token (a letter, ⌫, ↵, ←) passes through verbatim.
 * The browser label is ⌃ (Ctrl), not the word "Ctrl", because the OS may be macOS
 * (iPad/Mac Safari), where ⌃ is the native glyph for the Control key.
 */
export function formatKbd(tokens: string[], ctrlPrimary: boolean): string {
  const labels: Record<string, string> = ctrlPrimary
    ? { mod: '⌃', alt: 'Alt', shift: '⇧' }
    : { mod: '⌘', alt: '⌥', shift: '⇧' }
  return tokens.map((t) => labels[t] ?? t).join(ctrlPrimary ? '+' : '')
}

/**
 * Render a shortcut for a <Kbd> chip, tooltip, or hint string, in the live mode. Thin
 * wrapper over `formatKbd`; the callers stay `kbdLabel('mod', 'B')` as in the shell.
 */
export function kbdLabel(...tokens: string[]): string {
  return formatKbd(tokens, ctrlIsPrimary)
}
