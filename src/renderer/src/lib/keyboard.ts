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

// Effective renderer platform, surfaced by the preload bridge (the same value <html>
// is tagged with). Defaults to 'darwin' when the bridge is absent (unit tests) so the
// existing macOS labels/behaviour stay the test baseline.
const platform = window.porcelain?.platform ?? 'darwin'
export const isMac = platform === 'darwin'
export const isLinux = platform === 'linux'

/**
 * The primary shortcut modifier is pressed — Cmd (⌘) on macOS, Ctrl elsewhere. For the
 * loose case where the OTHER of Cmd/Ctrl is also allowed (matches the codebase's existing
 * `e.metaKey || e.ctrlKey` sites, which already work on Linux).
 */
export function hasMod(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return isMac ? e.metaKey : e.ctrlKey
}

/**
 * The primary modifier is pressed AND the foreign one (the OTHER of Cmd/Ctrl) is NOT —
 * preserves the original `metaKey && !ctrlKey` exclusivity, per platform. Use where a
 * shortcut must not fire on the wrong modifier (tab switch ⌘1–7, split ⌘⇧S). On macOS
 * this is byte-identical to the old `e.metaKey && !e.ctrlKey`.
 */
export function isModExclusive(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
}

const MODIFIER_LABELS: Record<string, string> = isMac
  ? { mod: '⌘', alt: '⌥', shift: '⇧' }
  : { mod: 'Ctrl', alt: 'Alt', shift: 'Shift' }

/**
 * Format a keyboard shortcut for a <Kbd> chip or tooltip. The tokens 'mod' | 'alt' |
 * 'shift' render as the platform label (⌘/⌥/⇧ on macOS, Ctrl/Alt/Shift elsewhere); any
 * other token (a letter, ⌫, ↵, ←) passes through. Joined tight on macOS (⌘⇧F), with '+'
 * on Linux/Windows (Ctrl+Shift+F).
 */
export function kbdLabel(...tokens: string[]): string {
  return tokens.map((t) => MODIFIER_LABELS[t] ?? t).join(isMac ? '' : '+')
}
