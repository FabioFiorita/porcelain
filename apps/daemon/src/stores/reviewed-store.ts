import { ACTIVE_FILES } from '@shared/project-porcelain'
import { z } from 'zod'
import { createProjectChannel } from '../net/project-channel'

/**
 * Reviewed marks for the active review — `<repo>/.porcelain/reviewed.json`.
 * ONE-WAY app→agent. Marks are content-fingerprinted; stale marks prune on read.
 */

const reviewedMarkSchema = z.object({ path: z.string(), fingerprint: z.string() })
export type ReviewedMark = z.infer<typeof reviewedMarkSchema>

const reviewedSchema = z.array(reviewedMarkSchema)

const channel = createProjectChannel({
  fileName: ACTIVE_FILES.reviewed,
  schema: reviewedSchema,
  empty: (): ReviewedMark[] => [],
})

function dedupeByPath(marks: ReviewedMark[]): ReviewedMark[] {
  return [...new Map(marks.map((m) => [m.path, m])).values()]
}

export async function readReviewedMarks(repoPath: string): Promise<ReviewedMark[]> {
  return channel.read(repoPath)
}

/**
 * Remove exactly these marks — matched on path AND fingerprint, read-modify-write —
 * so a mark another writer added between the caller's snapshot and this prune is
 * never dropped along with the stale one it replaced.
 */
export async function removeReviewedMarks(
  repoPath: string,
  marks: readonly ReviewedMark[],
): Promise<void> {
  if (marks.length === 0) return
  const stale = new Set(marks.map((m) => `${m.path}\0${m.fingerprint}`))
  await channel.mutate(repoPath, (all) =>
    all.filter((m) => !stale.has(`${m.path}\0${m.fingerprint}`)),
  )
}

export async function clearReviewedPaths(repoPath: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const removed = new Set(paths)
  await channel.mutate(repoPath, (all) => all.filter((m) => !removed.has(m.path)))
}

export async function setReviewedMarks(repoPath: string, marks: ReviewedMark[]): Promise<void> {
  await channel.write(repoPath, dedupeByPath(marks))
}
