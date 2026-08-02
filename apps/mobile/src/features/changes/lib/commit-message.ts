const PREFIX_RE = /^([a-z][a-z0-9-]*)(?:\(([^)]+)\))?(!)?:[ \t]*/

export type CommitPrefix = {
  readonly scope: string | null
  readonly type: string | null
}

export function parseCommitPrefix(message: string): CommitPrefix {
  const firstLine = message.split('\n', 1)[0] ?? ''
  const match = PREFIX_RE.exec(firstLine)
  return { scope: match?.[2] ?? null, type: match?.[1] ?? null }
}

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
