import type {
  ReviewedMark,
  ReviewedScope,
  ReviewMarksGit,
  ReviewMarksStore,
} from './review-marks-capabilities'

/**
 * The reviewed paths, reconciled. Only the marked paths need fingerprinting (few
 * files), and a mark whose content changed — external commit, amend, post-mark edit —
 * is pruned and written through, so `reviewed.json` stays truthful for the CLI reader.
 *
 * The set is re-read AFTER the prune so a concurrent mark (the UI's optimistic tick)
 * is never omitted from this response — that omission used to overwrite the client
 * cache and make the mark appear to un-toggle a second later.
 */
export function createReadReviewedPaths(deps: { store: ReviewMarksStore; git: ReviewMarksGit }) {
  return async ({
    projectPath,
    scope = { type: 'working' },
  }: {
    projectPath: string
    scope?: ReviewedScope
  }): Promise<string[]> => {
    const allMarks = await deps.store.read(projectPath)
    const marks = allMarks.filter((mark) => sameScope(mark.scope, scope))
    const current = await deps.git.fingerprints(
      projectPath,
      marks.map((mark) => mark.path),
      scope,
    )
    const stale = marks.filter((mark) => !survives(mark, current))
    if (stale.length === 0) return marks.map((mark) => mark.path)
    await deps.store.remove(projectPath, stale)
    return (await deps.store.read(projectPath))
      .filter((mark) => sameScope(mark.scope, scope))
      .map((mark) => mark.path)
  }
}

function sameScope(left: ReviewedScope | undefined, right: ReviewedScope): boolean {
  const normalized = left ?? { type: 'working' as const }
  return (
    normalized.type === right.type &&
    (normalized.type === 'working' || (right.type === 'branch' && normalized.base === right.base))
  )
}

/** An empty fingerprint never survives; an unfingerprinted path is left alone. */
function survives(mark: ReviewedMark, current: ReadonlyMap<string, string>): boolean {
  if (mark.fingerprint === '') return false
  const now = current.get(mark.path)
  return now === undefined || now === mark.fingerprint
}
