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
 * "Insert a newline, don't submit" as `ESC CR` (`\x1b\r`) — the exact bytes macOS sends
 * for Meta/Option+Enter, which Claude Code (and readline-style TUIs) accept as a newline
 * in their default LEGACY keyboard mode, no setup required. We send it for both ⇧↵ and ⌘↵.
 *
 * What does NOT work, and why:
 * - A bare LF (`\n`) or CR (`\r`) both SUBMIT. `\n` only *looked* like a newline on an
 *   empty prompt because an empty submit is a no-op — with text present it sends.
 * - The CSI-u / Kitty sequence `ESC [ 13 ; 2 u` (what Ghostty/iTerm2 emit for ⇧↵) is
 *   ignored here: Claude Code parses CSI-u only after negotiating the Kitty keyboard
 *   protocol, and xterm.js never advertises it, so Claude Code stays in legacy mode.
 *   We intercept the key and write bytes ourselves, so legacy `ESC CR` is the right tool.
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
 * The byte a Ctrl chord sends, for the key bar's sticky Ctrl (tap Ctrl, then a letter).
 * A soft keyboard has no Ctrl at all, so on a phone this is the ONLY way to reach ^C/^D/
 * ^Z/^R/^A/^E — the chords a shell is unusable without.
 *
 * The mapping is the tty's own: Ctrl clears the top bits of the ASCII code, so `@A-Z[\]^_`
 * (0x40–0x5F) become 0x00–0x1F. Two conventional extras the range misses: `?` sends DEL
 * (0x7F) and Space sends NUL (0x00). Case-insensitive — a soft keyboard's autocapitalized
 * `C` must still be ^C. Returns null for anything else (arrows, Enter, a named key), so the
 * caller lets xterm handle the key normally instead of swallowing it.
 */
export function controlByte(key: string): string | null {
  if (key.length !== 1) return null
  if (key === '?') return '\x7f'
  if (key === ' ') return '\x00'
  const code = key.toUpperCase().charCodeAt(0)
  if (code >= 0x40 && code <= 0x5f) return String.fromCharCode(code - 0x40)
  return null
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
