import {
  type ArrowDirection,
  terminalArrowBytes,
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

/**
 * Send an arrow, honouring the terminal's live DECCKM state. The key bar writes bytes
 * directly, so unlike a real keypress it has to read the mode itself: a full-screen TUI puts
 * the terminal in application-cursor mode, where the normal `ESC [ A` form is inserted as a
 * literal `[A` instead of moving the cursor.
 */
export function sendTerminalArrow(id: string, direction: ArrowDirection): void {
  const applicationCursorKeys = getTerminal(id)?.modes.applicationCursorKeysMode ?? false
  // An arrow cancels an armed modifier without being encoded by it: Meta+← must stay a word
  // jump (`ESC b`, sent by the bar's own key), not ESC followed by an arrow sequence, which
  // readline reads as two separate keys.
  takeArmedModifier(id)
  sendTerminalBytes(id, terminalArrowBytes(direction, applicationCursorKeys))
}
