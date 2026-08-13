import { PROJECT_FILES } from '@shared/project-porcelain'
import { z } from 'zod'
import { createProjectChannel } from '../net/project-channel'
import { FILE_SOURCES } from '../review/review-set'

/**
 * Active-review SNAPSHOT — app-computed git-truth tags for listed files.
 * `<repo>/.porcelain/active-review.json`. ONE-WAY app→agent (CLI only reads).
 */

const activeReviewSnapshotFileSchema = z.object({
  path: z.string(),
  source: z.enum(FILE_SOURCES),
  layer: z.string(),
})

const activeReviewSnapshotSchema = z.object({
  name: z.string(),
  files: z.array(activeReviewSnapshotFileSchema),
})
export type ActiveReviewSnapshot = z.infer<typeof activeReviewSnapshotSchema>

const channel = createProjectChannel({
  fileName: PROJECT_FILES.activeReview,
  schema: activeReviewSnapshotSchema,
  empty: (): ActiveReviewSnapshot => ({ name: '', files: [] }),
})

export function activeReviewSnapshotPath(repoPath: string): string {
  return channel.path(repoPath)
}

export async function readActiveReviewSnapshot(
  repoPath: string,
): Promise<ActiveReviewSnapshot | null> {
  const snap = await channel.read(repoPath)
  if (snap.files.length === 0 && snap.name === '') return null
  return snap
}

const lastWritten = new Map<string, string>()

export async function writeActiveReviewSnapshot(
  repoPath: string,
  snapshot: ActiveReviewSnapshot,
): Promise<void> {
  const key = snapshot.files.length === 0 ? '' : JSON.stringify(snapshot)
  if (lastWritten.get(repoPath) === key) return
  lastWritten.set(repoPath, key)
  if (snapshot.files.length === 0) {
    await channel.write(repoPath, { name: '', files: [] })
    return
  }
  await channel.write(repoPath, snapshot)
}
