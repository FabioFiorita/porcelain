/** Fallback types offered only when the history has no conventional commits. */
export const DEFAULT_COMMIT_TYPES = ['feat', 'fix', 'chore', 'refactor', 'docs', 'test']

export interface CommitConventions {
  /** Commit types the repo actually uses, most-used first. */
  types: string[]
  /** Scopes seen in history (the `dtc` of `feat(dtc):`), most-used first. */
  scopes: string[]
}

const SUBJECT_RE = /^([a-z][a-z0-9-]*)(?:\(([^)]+)\))?!?:/
const MAX_TYPES = 8
const MAX_SCOPES = 8

const byCount = (counts: Map<string, number>): string[] =>
  [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key)

/** Learn the commit vocabulary a repo actually uses from its log subjects. */
export function parseConventions(subjects: readonly string[]): CommitConventions {
  const typeCounts = new Map<string, number>()
  const scopeCounts = new Map<string, number>()

  for (const subject of subjects) {
    const match = SUBJECT_RE.exec(subject)
    if (!match) continue
    const [, type, scope] = match
    if (type) typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)
    if (scope) scopeCounts.set(scope, (scopeCounts.get(scope) ?? 0) + 1)
  }

  const used = byCount(typeCounts).slice(0, MAX_TYPES)
  return {
    types: used.length > 0 ? used : [...DEFAULT_COMMIT_TYPES],
    scopes: byCount(scopeCounts).slice(0, MAX_SCOPES),
  }
}
