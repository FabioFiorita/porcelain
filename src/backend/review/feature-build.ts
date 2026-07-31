import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ChangedFile, DiffStat } from './diff'
import { featureKey } from './feature-key'
import { writeFeatureSnapshot } from './feature-snapshot-store'
import { buildFeatureView, type FeatureReading, type FeatureView } from './feature-view'
import { DEFAULT_LAYERS, type Layer } from './flow'
import { readLayers } from './layers-store'
import type { ReviewSet } from './review-set'
import { readReviewSet } from './review-store'
import { workingTreeSnapshot } from './working-tree'

// One shared build per snapshot — both feature procedures reuse it instead of each
// re-reading ≤200 sources and rebuilding the view for the identical key. Keyed on
// repoPath; the key encodes status+numstat+layers+reviewSet so it self-busts on any
// working-tree change that affects the feature view.
const featureBuildCache = new Map<
  string,
  { key: string; view: FeatureView; sources: Map<string, string> }
>()

// The (heavier still) inline reading surface, memoized on the same key. Only built
// when an agent review set is present (the agent declares it via the porcelain CLI),
// so the slice heuristic runs only on curated files; the baseline returns null
// cheaply from the gather alone.
const featureReadingCache = new Map<string, { key: string; reading: FeatureReading }>()

// Read working-tree sources into `sources`, skipping already-read and oversized
// files (the feature build parses imports off the contents).
export async function readSourcesInto(
  repoPath: string,
  paths: readonly string[],
  sources: Map<string, string>,
): Promise<void> {
  await Promise.all(
    paths.map(async (path) => {
      if (sources.has(path)) return
      try {
        const content = await readFile(join(repoPath, path), 'utf8')
        if (content.length < 1024 * 1024) sources.set(path, content)
      } catch {
        // deleted / unreadable files have no working-tree source to parse
      }
    }),
  )
}

// Cheap phase shared by both feature procedures: the working-tree snapshot, agent
// set, and layers → the memo key. Each procedure checks its own cache on this key
// before doing the expensive source reads. (Git status is only used to tag listed
// files as `changed`; membership of Execution is the review set alone.)
export async function gatherFeature(input: string): Promise<{
  files: ChangedFile[]
  stats: DiffStat[]
  layers: Layer[]
  reviewSet: ReviewSet | null
  key: string
}> {
  const [{ files, stats }, stored, reviewSet] = await Promise.all([
    workingTreeSnapshot(input),
    readLayers(input),
    readReviewSet(input),
  ])
  const layers = stored ?? DEFAULT_LAYERS
  const key = featureKey(files, stats, layers, reviewSet)
  return { files, stats, layers, reviewSet, key }
}

// A gather narrowed to "an agent review set exists" — the only state the feature
// build runs in now (both procedures return null to the renderer without one).
export type ReviewGather = Awaited<ReturnType<typeof gatherFeature>> & { reviewSet: ReviewSet }

// Expensive phase shared on a cache miss: read only agent-declared file sources
// (plus section-anchor targets — Intent may anchor a path not listed in --files),
// then build the feature view. Returns the view AND the sources (the reading
// surface needs them to slice context/shipped files).
async function buildFeatureFromGather(
  input: string,
  g: ReviewGather,
): Promise<{ view: FeatureView; sources: Map<string, string> }> {
  const sources = new Map<string, string>()
  await readSourcesInto(
    input,
    [
      ...g.reviewSet.files.map((file) => file.path),
      ...g.reviewSet.sections.flatMap((section) => section.anchors.map((anchor) => anchor.path)),
    ],
    sources,
  )
  const statByPath = new Map(
    g.stats.map((s) => [s.path, { additions: s.additions, deletions: s.deletions }]),
  )
  const view = buildFeatureView({
    name: g.reviewSet.name,
    changed: g.files,
    reviewSet: g.reviewSet,
    sources,
    stats: statByPath,
    layers: g.layers,
  })
  return { view, sources }
}

// Shared cache accessor — returns the memoized build for the current snapshot,
// or runs buildFeatureFromGather once and stores the result. Both feature
// procedures call this so the expensive source-read + view-build runs at most
// once per snapshot regardless of which procedure polls first.
export async function getFeatureBuild(
  input: string,
  g: ReviewGather,
): Promise<{ key: string; view: FeatureView; sources: Map<string, string> }> {
  const cached = featureBuildCache.get(input)
  if (cached && cached.key === g.key) return cached
  const { view, sources } = await buildFeatureFromGather(input, g)
  const entry = { key: g.key, view, sources }
  featureBuildCache.set(input, entry)
  // Snapshot the computed view to the app→agent channel so the agent can read (via
  // the porcelain CLI) which files are actually `changed` (diffed) vs context/shipped
  // — git truth the dependency-free CLI can't derive itself. Skipped when unchanged.
  await writeFeatureSnapshot(input, {
    name: view.name,
    files: view.groups.flatMap((group) =>
      group.files.map((file) => ({ path: file.path, source: file.source, layer: group.layer })),
    ),
  })
  return entry
}

/** The memoized reading for this snapshot key, or null when the key moved on. */
export function cachedFeatureReading(repoPath: string, key: string): FeatureReading | null {
  const cached = featureReadingCache.get(repoPath)
  return cached && cached.key === key ? cached.reading : null
}

export function storeFeatureReading(repoPath: string, key: string, reading: FeatureReading): void {
  featureReadingCache.set(repoPath, { key, reading })
}
