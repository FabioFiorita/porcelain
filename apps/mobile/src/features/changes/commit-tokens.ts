/**
 * The conventional-commit token pickers, minus their markup.
 *
 * A token is `type` or `scope` from `type(scope): summary`. The chips never hold the value —
 * it is parsed back out of the message text every render — so everything here is a derivation
 * of the message and the repo's own vocabulary, with no state of its own.
 */

/** Which half of a conventional prefix a chip edits. */
export type TokenKind = 'scope' | 'type'

/** What the chip prints when closed: the value in its written form, or the kind as a prompt. */
export function tokenChipLabel(kind: TokenKind, value: string | null): string {
  if (value === null) return kind
  return kind === 'scope' ? `(${value})` : value
}

/** How an option reads in the list — a scope wears the parentheses it will be written with. */
export function tokenOptionLabel(kind: TokenKind, option: string): string {
  return kind === 'scope' ? `(${option})` : option
}

export type TokenPicker = {
  /** The repo's own values that match what has been typed, in the order the daemon gave them. */
  matches: string[]
  /**
   * The typed value, when it is worth offering as a new token — non-empty and not already one
   * of the repo's. Null otherwise, so the caller has nothing to decide.
   */
  addition: string | null
  /** Neither a match nor an addition: the list has nothing at all to show. */
  empty: boolean
}

/**
 * Filter a repo's tokens by what has been typed, and decide whether to offer it as a new one.
 *
 * Case-insensitive, because the field is where a human types `Fix` for a repo that writes `fix`
 * and should still be shown the existing token rather than invited to invent a second spelling.
 * The addition keeps the exact text typed — the repo's casing convention is the repo's business,
 * and this is how a genuinely new token gets in.
 */
export function tokenPicker(options: readonly string[], query: string): TokenPicker {
  const trimmed = query.trim()
  const needle = trimmed.toLowerCase()
  const matches = options.filter((option) => option.toLowerCase().includes(needle))
  const addition = trimmed !== '' && !options.includes(trimmed) ? trimmed : null
  return { addition, empty: matches.length === 0 && addition === null, matches }
}
