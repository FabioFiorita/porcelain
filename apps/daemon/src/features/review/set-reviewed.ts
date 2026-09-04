import type { ReviewedScope, ReviewMarksGit, ReviewMarksStore } from './review-marks-capabilities'

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
    scope = { type: 'working' },
  }: {
    projectPath: string
    paths: string[]
    reviewed: boolean
    scope?: ReviewedScope
  }): Promise<void> => {
    const existing = await deps.store.read(projectPath)
    if (!reviewed) {
      const dropped = new Set(paths)
      await deps.store.write(
        projectPath,
        existing.filter((mark) => !sameScope(mark.scope, scope) || !dropped.has(mark.path)),
      )
      return
    }
    const fingerprints = await deps.git.fingerprints(projectPath, paths, scope)
    const marked = new Set(paths)
    await deps.store.write(projectPath, [
      ...existing.filter((mark) => !sameScope(mark.scope, scope) || !marked.has(mark.path)),
      ...Array.from(fingerprints, ([path, fingerprint]) => ({
        path,
        fingerprint,
        ...(scope.type === 'branch' ? { scope } : {}),
      })),
    ])
  }
}

function sameScope(left: ReviewedScope | undefined, right: ReviewedScope): boolean {
  const normalized = left ?? { type: 'working' as const }
  return (
    normalized.type === right.type &&
    (normalized.type === 'working' || (right.type === 'branch' && normalized.base === right.base))
  )
}
