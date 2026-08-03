import { PROJECT_FILES } from '@shared/project-porcelain'
import { z } from 'zod'
import { createProjectChannel } from '../net/project-channel'
import { ensureProjectCompanion } from '../project/migrate-home'

/**
 * Reviewed marks for the active review — `<repo>/.porcelain/reviewed.json`.
 * ONE-WAY app→agent. Marks are content-fingerprinted; stale marks prune on read.
 */

const reviewedMarkSchema = z.object({ path: z.string(), fingerprint: z.string() })
export type ReviewedMark = z.infer<typeof reviewedMarkSchema>

const reviewedSchema = z.array(reviewedMarkSchema)

const channel = createProjectChannel({
  fileName: PROJECT_FILES.reviewed,
  schema: reviewedSchema,
  empty: (): ReviewedMark[] => [],
})

async function ready(repoPath: string): Promise<void> {
  await ensureProjectCompanion(repoPath)
}

function dedupeByPath(marks: ReviewedMark[]): ReviewedMark[] {
  return [...new Map(marks.map((m) => [m.path, m])).values()]
}

export async function readReviewedMarks(repoPath: string): Promise<ReviewedMark[]> {
  await ready(repoPath)
  return channel.read(repoPath)
}

export async function readReviewedPaths(repoPath: string): Promise<string[]> {
  return (await readReviewedMarks(repoPath)).map((m) => m.path)
}

export async function markReviewed(
  repoPath: string,
  path: string,
  fingerprint: string,
): Promise<void> {
  await ready(repoPath)
  await channel.mutate(repoPath, (all) => {
    const others = all.filter((m) => m.path !== path)
    return [...others, { path, fingerprint }]
  })
}

export async function unmarkReviewed(repoPath: string, path: string): Promise<void> {
  await ready(repoPath)
  await channel.mutate(repoPath, (all) => all.filter((m) => m.path !== path))
}

export async function clearReviewedPaths(repoPath: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await ready(repoPath)
  const removed = new Set(paths)
  await channel.mutate(repoPath, (all) => all.filter((m) => !removed.has(m.path)))
}

export async function setReviewedMarks(repoPath: string, marks: ReviewedMark[]): Promise<void> {
  await ready(repoPath)
  await channel.write(repoPath, dedupeByPath(marks))
}

export function reconcileMarks(
  marks: ReviewedMark[],
  currentFingerprints: Map<string, string>,
): { marks: ReviewedMark[]; pruned: boolean } {
  const survivors = marks.filter((m) => {
    if (m.fingerprint === '') return false
    const current = currentFingerprints.get(m.path)
    return current === undefined || current === m.fingerprint
  })
  return { marks: survivors, pruned: survivors.length !== marks.length }
}

export async function reconcileReviewed(
  repoPath: string,
  snapshotMarks: ReviewedMark[],
  currentFingerprints: Map<string, string>,
): Promise<string[]> {
  const { marks: survivors, pruned } = reconcileMarks(snapshotMarks, currentFingerprints)
  if (pruned) {
    const stale = new Set(
      snapshotMarks.filter((m) => !survivors.includes(m)).map((m) => `${m.path}\0${m.fingerprint}`),
    )
    await channel.mutate(repoPath, (all) =>
      all.filter((m) => !stale.has(`${m.path}\0${m.fingerprint}`)),
    )
  }
  return readReviewedPaths(repoPath)
}
