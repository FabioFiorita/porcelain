/** Leading conventional-commit prefix on a subject line: `type(scope)!: `. */
const PREFIX_RE = /^([a-z][a-z0-9-]*)(?:\(([^)]+)\))?(!)?:[ \t]*/

export interface CommitPrefix {
  type: string | null
  scope: string | null
}

/** Parse the `type`/`scope` from a commit message's first line, if present. */
export function parseCommitPrefix(message: string): CommitPrefix {
  const firstLine = message.split('\n', 1)[0] ?? ''
  const match = PREFIX_RE.exec(firstLine)
  return { type: match?.[1] ?? null, scope: match?.[2] ?? null }
}

/**
 * Rewrite the first line's conventional-commit prefix to `type(scope): `, keeping
 * everything else intact. A null `type` strips any existing prefix; `scope` is
 * dropped without a type (a bare `(scope):` isn't valid). The subject body and any
 * following lines (the commit body) are preserved verbatim — this only edits the
 * leading prefix, so the message textarea stays the single source of truth.
 */
export function applyCommitPrefix(
  message: string,
  type: string | null,
  scope: string | null,
): string {
  const newlineAt = message.indexOf('\n')
  const firstLine = newlineAt === -1 ? message : message.slice(0, newlineAt)
  const rest = newlineAt === -1 ? '' : message.slice(newlineAt)
  const match = PREFIX_RE.exec(firstLine)
  const body = match ? firstLine.slice(match[0].length) : firstLine
  if (!type) return body + rest
  return `${type}${scope ? `(${scope})` : ''}: ${body}${rest}`
}
