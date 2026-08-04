/**
 * Translate a macOS editing chord into the control bytes a shell's line editor
 * (readline / the tty line discipline) expects — the behaviours a real terminal like
 * Ghostty gives you that xterm.js doesn't send on its own. Returns null to let xterm
 * handle the key normally (plain typing, Ctrl-* chords, arrows). Pure, so the mapping is
 * unit-tested without a live PTY.
 *
 * ⌘ is line-wise, ⌥ is word-wise — matching Ghostty's macOS defaults:
 *   ⌘⌫ → delete to line start (Ctrl-U)   ⌘← / ⌘→ → line start / end (Ctrl-A / Ctrl-E)
 *   ⌥⌫ → delete word back               ⌥← / ⌥→ → word back / forward
 *   ⇧↵ / ⌘↵ → insert a newline instead of submitting (Claude Code & other multiline prompts)
 *
 * ⌥ + a letter is deliberately left alone so Option-compose (´ + e → é) still types.
 */

/**
 * "Insert a newline, don't submit" as `ESC CR` (`\x1b\r`) — what macOS sends for Meta/
 * Option+Enter, accepted by Claude Code / readline-style TUIs in default LEGACY keyboard
 * mode. Sent for both ⇧↵ and ⌘↵. A bare LF/CR both SUBMIT (an empty prompt disguises this —
 * an empty submit is a no-op). The CSI-u/Kitty form (`ESC [ 13 ; 2 u`, Ghostty/iTerm2's
 * emit) isn't an alternative: it needs Kitty-protocol negotiation, which xterm.js never
 * advertises — legacy `ESC CR` is the only route in.
 */
const NEWLINE = '\x1b\r'

export interface EditChord {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

export function terminalEditBytes({
  key,
  metaKey,
  ctrlKey,
  altKey,
  shiftKey,
}: EditChord): string | null {
  // ⌘ alone — line-wise editing.
  if (metaKey && !ctrlKey && !altKey && !shiftKey) {
    if (key === 'Backspace') return '\x15' // Ctrl-U: delete to start of line
    if (key === 'ArrowLeft') return '\x01' // Ctrl-A: start of line
    if (key === 'ArrowRight') return '\x05' // Ctrl-E: end of line
    if (key === 'Enter') return NEWLINE // newline, not the submit CR (same as ⇧↵)
    return null
  }
  // ⌥ alone — word-wise editing.
  if (altKey && !ctrlKey && !metaKey && !shiftKey) {
    if (key === 'Backspace') return '\x1b\x7f' // ESC DEL: delete word backward
    if (key === 'ArrowLeft') return '\x1bb' // ESC b: word backward
    if (key === 'ArrowRight') return '\x1bf' // ESC f: word forward
    return null
  }
  // ⇧↵ — newline instead of the submit CR, so TUIs can take multiline input.
  if (shiftKey && !metaKey && !ctrlKey && !altKey && key === 'Enter') return NEWLINE

  return null
}

/**
 * The byte a Ctrl chord sends, for the key bar's sticky Ctrl (tap Ctrl, then a letter) —
 * a soft keyboard's only route to ^C/^D/^Z/^R/^A/^E. Mirrors the tty's own mapping: Ctrl
 * clears the top bits of the ASCII code, so `@A-Z[\]^_` (0x40–0x5F) become 0x00–0x1F, plus
 * two conventional extras the range misses (`?` → DEL 0x7F, Space → NUL 0x00).
 * Case-insensitive (an autocapitalized `C` must still be ^C). Null for anything else, so
 * the caller lets xterm handle the key.
 */
export function controlByte(key: string): string | null {
  if (key.length !== 1) return null
  if (key === '?') return '\x7f'
  if (key === ' ') return '\x00'
  const code = key.toUpperCase().charCodeAt(0)
  if (code >= 0x40 && code <= 0x5f) return String.fromCharCode(code - 0x40)
  return null
}

/**
 * The key bar's sticky modifiers: tap one, then a key, and the modifier applies to that one
 * keystroke from either source — a bar button or the soft keyboard. A soft keyboard has no
 * Ctrl and no Alt, so this is the only route to ^C/^R and to the ESC-prefixed Meta chords that
 * readline and agent TUIs bind.
 */
export type TerminalModifier = 'ctrl' | 'meta'

/**
 * Apply an armed modifier to the next keystroke. Meta is the ESC prefix, which is how a tty has
 * always carried Alt — `ESC f` is word-forward, and Claude Code reads `ESC` + key the same way.
 * Returns null when the pair has no encoding (Ctrl-1, Meta with nothing typed), so the caller
 * can send the key unmodified instead of swallowing it.
 *
 * Arrows are deliberately not routed here: Meta+← must be `ESC b` (word-wise, matching
 * `terminalEditBytes`), not `ESC` + the arrow's own escape sequence, which readline reads as two
 * separate keys. The caller resolves arrows before reaching for this.
 */
export function terminalModifierBytes(modifier: TerminalModifier, key: string): string | null {
  if (modifier === 'ctrl') return controlByte(key)
  return key === '' ? null : `\x1b${key}`
}

export type ArrowDirection = 'up' | 'down' | 'left' | 'right'

const ARROW_FINAL: Record<ArrowDirection, string> = { up: 'A', down: 'B', right: 'C', left: 'D' }

/**
 * The bytes an arrow key sends — the key bar writes to the PTY directly, so unlike a real
 * keypress it has to honor DECCKM itself. In application-cursor mode (vim, less, most
 * full-screen TUIs set it) arrows are `ESC O A`; in normal mode they're `ESC [ A`. Sending
 * the normal form unconditionally is the classic bug: arrows insert a literal `[A` in vim
 * instead of moving. The caller reads the live mode off the xterm instance.
 */
export function terminalArrowBytes(
  direction: ArrowDirection,
  applicationCursorKeys: boolean,
): string {
  return `\x1b${applicationCursorKeys ? 'O' : '['}${ARROW_FINAL[direction]}`
}
