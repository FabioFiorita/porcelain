import { PROJECT_FILES } from '@shared/project-porcelain'
import { z } from 'zod'
import { createProjectChannel } from '../net/project-channel'
import { FILE_SOURCES } from '../review/review-set'

/**
 * Feature-view SNAPSHOT — app-computed git-truth tags for listed files.
 * `<repo>/.porcelain/feature-view.json`. ONE-WAY app→agent (CLI only reads).
 */

const featureSnapshotFileSchema = z.object({
  path: z.string(),
  source: z.enum(FILE_SOURCES),
  layer: z.string(),
})

const featureSnapshotSchema = z.object({
  name: z.string(),
  files: z.array(featureSnapshotFileSchema),
})
export type FeatureSnapshot = z.infer<typeof featureSnapshotSchema>

const channel = createProjectChannel({
  fileName: PROJECT_FILES.featureView,
  schema: featureSnapshotSchema,
  empty: (): FeatureSnapshot => ({ name: '', files: [] }),
})

export function featureSnapshotPath(repoPath: string): string {
  return channel.path(repoPath)
}

export async function readFeatureSnapshot(repoPath: string): Promise<FeatureSnapshot | null> {
  const snap = await channel.read(repoPath)
  if (snap.files.length === 0 && snap.name === '') return null
  return snap
}

const lastWritten = new Map<string, string>()

export async function writeFeatureSnapshot(
  repoPath: string,
  snapshot: FeatureSnapshot,
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
