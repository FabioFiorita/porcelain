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
