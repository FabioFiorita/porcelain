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

export type FieldEdit = {
  /** Bytes to send to the PTY, already in terminal form. */
  bytes: string
  /** What the field should hold next; feed this back as `previous` on the following edit. */
  value: string
}

export function terminalFieldEdit(previous: string, next: string): FieldEdit {
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
  // carriage return.
  const typed = added.replace(/\n/g, '\r')

  // Start the field over once the line belongs to the shell, or once the human has deleted the
  // sentinel itself — an empty field cannot report the NEXT backspace, because deleting from
  // empty changes nothing for the handler to see.
  const submitted = added.includes('\n')
  return {
    bytes: `${backspaces}${typed}`,
    value: submitted || next === '' ? FIELD_SENTINEL : next,
  }
}
