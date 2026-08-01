/** Repo-relative path and commit formatting. Pure — no React, no `@expo/ui`, no `expo-*`. */

export function basename(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut === -1 ? path : path.slice(cut + 1)
}

/** The directory a file sits in, or `''` at the repo root — never `.`, which reads as a path. */
export function dirname(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut === -1 ? '' : path.slice(0, cut)
}

/** `+12 −3`, using the typographic minus git's own UIs use. Empty when nothing changed. */
export function formatStats(additions?: number, deletions?: number): string {
  const parts: string[] = []
  if (additions !== undefined && additions > 0) parts.push(`+${additions}`)
  if (deletions !== undefined && deletions > 0) parts.push(`−${deletions}`)
  return parts.join(' ')
}

export function shortHash(hash: string): string {
  return hash.slice(0, 7)
}

/** A commit's `%B` body splits into the subject line and the rest, with blank padding dropped. */
export function splitMessage(message: string): { subject: string; body: string } {
  const newline = message.indexOf('\n')
  if (newline === -1) return { body: '', subject: message.trim() }
  return {
    body: message.slice(newline + 1).trim(),
    subject: message.slice(0, newline).trim(),
  }
}

/** Working-tree staging, as the row can honestly say it. `partial` is git's `MM`. */
export function stagingLabel(file: { staged?: boolean; unstaged?: boolean }): string {
  if (file.staged !== true) return ''
  return file.unstaged === true ? 'Partly staged' : 'Staged'
}
