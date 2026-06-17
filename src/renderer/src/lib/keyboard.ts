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
