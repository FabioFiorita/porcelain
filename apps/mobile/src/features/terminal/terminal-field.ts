/**
 * What the software keyboard did to the hidden field, as terminal input.
 *
 * A phone has no key events worth trusting — the keyboard reports edits to a text field, and
 * autocorrect, predictive text and dictation all REPLACE a run of characters rather than
 * appending one. So the only honest reading of "what did the human type" is the difference
 * between what the field held and what it holds now.
 *
 * Diffing also side-steps the trap that produced the first version of this: a controlled value
 * that never changes is never pushed back down to the native field, so the field keeps
 * accumulating and every keystroke resends the whole line ("echo", "hecho", "heecho"…).
 *
 * Pure, so the cases that are painful to reproduce by hand — a dictated replacement, a
 * backspace past the sentinel, a paste — are unit tests rather than device sessions.
 */

/** A zero-width space the field can always delete, which is how Backspace becomes visible. */
export const FIELD_SENTINEL = '\u200b'

/**
 * Bracketed paste (DECSET 2004): the app asked to be told that a burst arrived at once instead
 * of as a run of keystrokes. Claude Code, vim and every readline-based prompt use it to put a
 * multi-line paste into their input box \u2014 without the brackets each newline is a separate
 * submit, so pasting a five-line diff runs four commands nobody typed.
 */
const PASTE_START = '\x1b[200~'
const PASTE_END = '\x1b[201~'

export type FieldEdit = {
  /** Bytes to send to the PTY, already in terminal form. */
  bytes: string
  /** What the field should hold next; feed this back as `previous` on the following edit. */
  value: string
}

export type FieldEditOptions = {
  /** Whether the program on the other end has requested bracketed paste. */
  bracketedPaste?: boolean
}

export function terminalFieldEdit(
  previous: string,
  next: string,
  options: FieldEditOptions = {},
): FieldEdit {
  if (next === previous) return { bytes: '', value: previous }

  let shared = 0
  while (shared < previous.length && shared < next.length && previous[shared] === next[shared]) {
    shared += 1
  }
  const removed = previous.length - shared
  const added = next.slice(shared)

  // Deletions first: a replacement is "take these back, then take these".
  const backspaces = '\x7f'.repeat(removed)
  // The field is multiline so Return inserts a newline instead of submitting; a shell wants the
  // carriage return. This holds inside the brackets too — that is what xterm sends for a paste,
  // and an app in bracketed mode reads the CRs as line breaks in its own buffer rather than as
  // submits.
  const typed = added.replace(/\n/g, '\r')

  // Paste-shaped: more than one character arrived and nothing was taken back. A keystroke is
  // one character; a correction (autocorrect, dictation, a predictive-text swap) always arrives
  // as deletions PLUS its replacement, so neither is mistaken for a paste.
  const pasted = removed === 0 && [...added].length > 1
  const body =
    options.bracketedPaste === true && pasted ? `${PASTE_START}${typed}${PASTE_END}` : typed

  // Start the field over once the line belongs to the program, or once the human has deleted
  // the sentinel itself — an empty field cannot report the NEXT backspace, because deleting
  // from empty changes nothing for the handler to see.
  const handedOff = added.includes('\n')
  return {
    bytes: `${backspaces}${body}`,
    value: handedOff || next === '' ? FIELD_SENTINEL : next,
  }
}
