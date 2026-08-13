import type { DiffHunk } from '../../git/diff'
import { buildReviewReading, type ReviewReading } from '../../review/active-review'
import type { ReviewEvidence, ReviewGit, ReviewReadingSources } from './review-reading-capabilities'

/**
 * The Review document: thesis + walkthrough sections (prose/diagram + anchored code
 * blocks) + the leftover files flow-grouped, with just the relevant lines (diff
 * hunks for changed files, symbol slices for context/shipped) and the loop-evidence
 * meta as the final chapter. Review-set-only — `null` without an agent review set,
 * so the slice heuristic only ever runs on the agent's curated, annotated set.
 *
 * Agent-authored section bodies (self-contained HTML, inline SVG) travel through
 * untouched and size-capped: they are destined only for the renderer's
 * `<iframe sandbox="" srcdoc>` path, never a `src` URL, which would drop the parent
 * CSP that backstops them.
 */
export function createReadReviewReading(deps: {
  sources: ReviewReadingSources
  git: ReviewGit
  evidence: ReviewEvidence
}) {
  return async ({ projectPath }: { projectPath: string }): Promise<ReviewReading | null> => {
    const gathered = await deps.sources.gather(projectPath)
    if (!gathered.reviewSet) return null
    // Evidence meta is read fresh on every poll (a cheap stat-level read): it is
    // NOT part of the feature key, so a cached reading would otherwise pin a
    // stale/absent final chapter until the working tree changed.
    const evidence = await deps.evidence.readSummary(projectPath)
    const cached = deps.sources.cachedReading(projectPath, gathered.key)
    // Evidence can change without the review key; always reattach it.
    if (cached) return { ...cached, evidence }
    const { view, sources } = await deps.sources.build(projectPath, {
      ...gathered,
      reviewSet: gathered.reviewSet,
    })
    const changed = view.groups
      .flatMap((group) => group.files)
      .filter((f) => f.source === 'changed')
    const diffs = new Map<string, DiffHunk[]>()
    await Promise.all(
      changed.map(async (file) => {
        try {
          diffs.set(file.path, await deps.git.fileHunks(projectPath, file.path))
        } catch {
          // file vanished/renamed between the status snapshot and this read —
          // leave it out; buildReviewReading falls back to an empty hunk list
        }
      }),
    )
    const reading = buildReviewReading({
      view,
      sections: gathered.reviewSet.sections,
      sources,
      diffs,
      evidence,
    })
    deps.sources.storeReading(projectPath, gathered.key, reading)
    return reading
  }
}
