import {
  type ArrowDirection,
  terminalArrowBytes,
  terminalEditBytes,
  terminalModifierBytes,
} from '@porcelain/client-runtime/terminal-keys'

import { writeTerminal } from '@/lib/daemon/terminal'

import { getTerminal, scrollTerminalToBottom } from './terminal-engine'
import { takeArmedModifier } from './terminal-input-store'

/**
 * Everything the human types, on its way to the PTY.
 *
 * Bytes go straight to the daemon rather than through the emulator's own input path: they must
 * reach the shell exactly as composed. The emulator only ever sees what the PTY echoes back,
 * which is what keeps its buffer a truthful picture of the session.
 *
 * Every send scrolls to the prompt, like a real keypress — a key tapped after scrolling up
 * through history should not type off-screen.
 */

export function sendTerminalBytes(id: string, data: string): void {
  if (data === '') return
  writeTerminal(id, data)
  scrollTerminalToBottom(id)
}

/**
 * Send typed text, applying any armed sticky modifier to its FIRST character only — a
 * modifier is one keystroke's worth, and the rest of a burst (autocomplete, a paste) is
 * ordinary input.
 */
export function sendTerminalText(id: string, text: string): void {
  if (text === '') return
  const modifier = takeArmedModifier(id)
  if (modifier === undefined) {
    sendTerminalBytes(id, text)
    return
  }
  const head = [...text][0] ?? ''
  const bytes = terminalModifierBytes(modifier, head)
  // No encoding for this pair (Ctrl-1, say) — send the key unmodified rather than swallow it.
  sendTerminalBytes(id, `${bytes ?? head}${text.slice(head.length)}`)
}

/** The DOM key name for each direction, which is the shared encoder's vocabulary. */
const ARROW_KEY: Record<ArrowDirection, string> = {
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
}

/**
 * Send an arrow, honouring the terminal's live DECCKM state. The key bar writes bytes
 * directly, so unlike a real keypress it has to read the mode itself: a full-screen TUI puts
 * the terminal in application-cursor mode, where the normal `ESC [ A` form is inserted as a
 * literal `[A` instead of moving the cursor.
 *
 * An armed Alt makes ← / → WORD-wise, exactly as ⌥←/⌥→ do on a real terminal. That is the one
 * modifier an arrow encodes, and it is deliberately NOT the generic ESC prefix: `ESC` followed
 * by an arrow's own escape sequence is two separate keys to readline, which is why the shared
 * encoder answers this chord with `ESC b` / `ESC f` instead.
 */
export function sendTerminalArrow(id: string, direction: ArrowDirection): void {
  // Every keystroke disarms, chord or not.
  const armed = takeArmedModifier(id)
  if (armed === 'meta') {
    const wordJump = terminalEditBytes({
      altKey: true,
      ctrlKey: false,
      key: ARROW_KEY[direction],
      metaKey: false,
      shiftKey: false,
    })
    // Up and Down have no word-wise form; they fall through to the plain arrow below.
    if (wordJump !== null) {
      sendTerminalBytes(id, wordJump)
      return
    }
  }
  const applicationCursorKeys = getTerminal(id)?.modes.applicationCursorKeysMode ?? false
  sendTerminalBytes(id, terminalArrowBytes(direction, applicationCursorKeys))
}

/**
 * Insert a newline instead of submitting the line — ⇧↵ on a keyboard that has one.
 *
 * Agent CLIs and other multiline prompts read a bare CR as "run it", so on a touch device there
 * was no way to write a second line at all: the hidden field's Return is a submit, and the
 * chord that means "newline" cannot be typed. The bytes are the shared encoder's, so this key
 * and the desktop client's ⇧↵ send exactly the same thing.
 */
export function sendTerminalNewline(id: string): void {
  takeArmedModifier(id)
  const bytes = terminalEditBytes({
    altKey: false,
    ctrlKey: false,
    key: 'Enter',
    metaKey: false,
    shiftKey: true,
  })
  // The shared encoder answers this chord unconditionally; null would mean it stopped doing so,
  // and sending a bare CR instead would submit the line this key exists to avoid.
  if (bytes !== null) sendTerminalBytes(id, bytes)
}
