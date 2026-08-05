/**
 * What the tree will accept as the name of a new or renamed entry.
 *
 * A **bare** name only. Every write in this tab joins the name onto the directory the row lives
 * in, so a separator here would quietly create somewhere else — the one thing a "New file in
 * src" dialog must never do — and `.`/`..` would create nowhere at all.
 *
 * Everything past this is the daemon's to refuse: a collision, a read-only directory, a name
 * the host filesystem dislikes. Those come back as its own message, which is the one worth
 * showing.
 */
export function nameError(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed === '') return 'Give it a name.'
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return 'A name cannot contain a path separator.'
  }
  if (trimmed === '.' || trimmed === '..') return 'That name is reserved.'
  return null
}
