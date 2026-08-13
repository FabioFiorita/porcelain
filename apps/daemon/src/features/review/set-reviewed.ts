import type { ReviewMarksGit, ReviewMarksStore } from './review-marks-capabilities'

/**
 * Set exactly these paths to `reviewed`. Total and idempotent: one bulk "mark all" or
 * "unmark all" stays one atomic write, and repeating it lands the same set.
 *
 * Marking fingerprints the named paths first, so each mark records the content it was
 * taken at and prunes once that content changes. Unmarking needs no fingerprint — it
 * removes the paths from the set outright.
 */
export function createSetReviewed(deps: { store: ReviewMarksStore; git: ReviewMarksGit }) {
  return async ({
    projectPath,
    paths,
    reviewed,
  }: {
    projectPath: string
    paths: string[]
    reviewed: boolean
  }): Promise<void> => {
    const existing = await deps.store.read(projectPath)
    if (!reviewed) {
      const dropped = new Set(paths)
      await deps.store.write(
        projectPath,
        existing.filter((mark) => !dropped.has(mark.path)),
      )
      return
    }
    const fingerprints = await deps.git.fingerprints(projectPath, paths)
    const marked = new Set(paths)
    await deps.store.write(projectPath, [
      ...existing.filter((mark) => !marked.has(mark.path)),
      ...Array.from(fingerprints, ([path, fingerprint]) => ({ path, fingerprint })),
    ])
  }
}
