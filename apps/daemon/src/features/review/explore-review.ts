import { buildExploreReading, type ExploreSeed, walkExplore } from '../../review/feature-explore'
import type { FeatureReading } from '../../review/feature-view'
import { DEFAULT_LAYERS, readLayers } from '../project-data'
import type { ReviewFiles, ReviewGit } from './review-reading-capabilities'

/**
 * Explore an existing feature read-only: seed from a symbol (or a whole file) and
 * walk the import/reference graph into the SAME flow-ordered, sliced reading
 * surface — no working-tree change, no agent. Files outside the working tree are
 * read on demand, bounded by the walk's depth (5) and file (60) caps and the
 * adapter's per-file size cap; an unreadable source is simply a leaf.
 */
export function createExploreReview(deps: { git: ReviewGit; files: ReviewFiles }) {
  return async ({
    projectPath,
    seed,
  }: {
    projectPath: string
    seed: ExploreSeed
  }): Promise<FeatureReading> => {
    const repoFiles = new Set(await deps.git.listFiles(projectPath))
    const sources = new Map<string, string>()
    const readSource = async (path: string): Promise<string | undefined> => {
      const cached = sources.get(path)
      if (cached !== undefined) return cached
      const content = await deps.files.readSource(projectPath, path)
      if (content !== undefined) sources.set(path, content)
      return content
    }
    const nodes = await walkExplore(seed, readSource, repoFiles)
    const layers = (await readLayers(projectPath)) ?? DEFAULT_LAYERS
    const name = seed.kind === 'symbol' ? seed.symbol : (seed.path.split('/').at(-1) ?? seed.path)
    return buildExploreReading(name, nodes, sources, layers)
  }
}
