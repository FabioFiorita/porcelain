import { z } from 'zod'
import { createHomeChannel } from './home-channel'
import { FILE_SOURCES } from './review-set'

/**
 * The feature-view SNAPSHOT channel: Porcelain's COMPUTED feature view for a repo
 * (the files it actually renders, each tagged with its git-truth source and flow
 * layer), keyed by absolute repo path, in `~/.porcelain/feature-view.json` — the
 * fixed home dir, because a plain `node` CLI process can't resolve userData.
 *
 * ONE-WAY, app→agent: the APP is the SOLE writer (`feature-build.ts`) and the CLI
 * (`src/cli/feature-view-file.ts`) only READS, so the agent learns which files are
 * `changed` (diffed) vs `context`/`shipped` — git truth the CLI cannot compute.
 * Content is app-supplied and inert, so no repo-containment guard; writes stay
 * atomic + in-process-serialized like every other channel.
 *
 * A DERIVED snapshot, never source of truth: it reflects the view as last rendered.
 * The agent's own pushed set is still `review get`.
 */
const featureSnapshotFileSchema = z.object({
  path: z.string(),
  source: z.enum(FILE_SOURCES),
  layer: z.string(),
})

const featureSnapshotSchema = z.record(
  z.string(),
  z.object({ name: z.string(), files: z.array(featureSnapshotFileSchema) }),
)
type FeatureSnapshots = z.infer<typeof featureSnapshotSchema>
export type FeatureSnapshot = FeatureSnapshots[string]

const channel = createHomeChannel<FeatureSnapshots>({
  envVar: 'PORCELAIN_FEATURE_VIEW',
  fileName: 'feature-view.json',
  schema: featureSnapshotSchema,
  empty: () => ({}),
})

export function featureSnapshotPath(): string {
  // Must match src/cli/feature-view-file.ts. PORCELAIN_FEATURE_VIEW redirects both sides.
  return channel.path()
}

/** Read back the stored snapshot for a repo (null when none / file absent). */
export async function readFeatureSnapshot(repoPath: string): Promise<FeatureSnapshot | null> {
  return (await channel.readAll())[repoPath] ?? null
}

// The last snapshot THIS process wrote per repo, so the 3s feature-view poll doesn't
// re-serialize + atomically rewrite the file when nothing changed. Main is one process
// for all windows, so a second window on the same repo computes the same snapshot and
// skips. Keyed value '' means "wrote an empty (deleted) entry".
const lastWritten = new Map<string, string>()

/**
 * Persist (or clear) a repo's computed feature view. A no-op when the snapshot is
 * unchanged from this process's last write; an empty file list drops the entry. Uses
 * the channel's serialized read-modify-write so a concurrent write to a DIFFERENT
 * repo's entry isn't clobbered.
 */
export async function writeFeatureSnapshot(
  repoPath: string,
  snapshot: FeatureSnapshot,
): Promise<void> {
  const key = snapshot.files.length === 0 ? '' : JSON.stringify(snapshot)
  if (lastWritten.get(repoPath) === key) return
  lastWritten.set(repoPath, key)
  await channel.mutate((all) => {
    if (snapshot.files.length === 0) delete all[repoPath]
    else all[repoPath] = snapshot
  })
}
