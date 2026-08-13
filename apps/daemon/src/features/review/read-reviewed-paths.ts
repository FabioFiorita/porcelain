import type { ReviewedMark, ReviewMarksGit, ReviewMarksStore } from './review-marks-capabilities'

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
  return async ({ projectPath }: { projectPath: string }): Promise<string[]> => {
    const marks = await deps.store.read(projectPath)
    const current = await deps.git.fingerprints(
      projectPath,
      marks.map((mark) => mark.path),
    )
    const stale = marks.filter((mark) => !survives(mark, current))
    if (stale.length === 0) return marks.map((mark) => mark.path)
    await deps.store.remove(projectPath, stale)
    return (await deps.store.read(projectPath)).map((mark) => mark.path)
  }
}

/** An empty fingerprint never survives; an unfingerprinted path is left alone. */
function survives(mark: ReviewedMark, current: ReadonlyMap<string, string>): boolean {
  if (mark.fingerprint === '') return false
  const now = current.get(mark.path)
  return now === undefined || now === mark.fingerprint
}
