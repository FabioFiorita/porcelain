import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ChangedFile, DiffStat } from '../git/diff'
import {
  gitCommitFiles,
  gitCommitNumstat,
  gitDefaultBranch,
  gitMergeBase,
  gitRangeChangedFilesFrom,
  gitRangeNumstatFrom,
} from '../git/git'
import { workingTreeSnapshot } from '../git/working-tree'
import { DEFAULT_LAYERS } from './default-layers'
import { buildFlow, type FlowGroup, type Layer } from './flow'
import { flowKey } from './review-key'

// Read up to 200 files' working-tree contents, run buildFlow, and attach
// additions/deletions from the stat map. Shared by the working, range, and commit
// loaders — each owns its own file/stat gathering, cache key, and cache store;
// this helper is the common "sources → groups" pipeline.
export async function readSourcesAndBuildFlow(
  repoPath: string,
  files: ChangedFile[],
  stats: DiffStat[],
  layers: Layer[],
): Promise<FlowGroup[]> {
  const sources = new Map<string, string>()
  await Promise.all(
    files.slice(0, 200).map(async (file) => {
      try {
        const content = await readFile(join(repoPath, file.path), 'utf8')
        if (content.length < 1024 * 1024) sources.set(file.path, content)
      } catch {
        // deleted / no-longer-in-working-tree files have no source to parse
      }
    }),
  )
  const statByPath = new Map(stats.map((s) => [s.path, s]))
  return buildFlow(files, sources, layers).map((group) => ({
    ...group,
    files: group.files.map((file) => ({
      ...file,
      additions: statByPath.get(file.path)?.additions,
      deletions: statByPath.get(file.path)?.deletions,
    })),
  }))
}

// gitFlow polls every 3s; re-reading up to 200 changed files each tick is the
// single heaviest recurring cost. Memoize on the parsed status+numstat+layers —
// file contents are only re-read when the working tree actually changes.
const flowCache = new Map<string, { key: string; groups: FlowGroup[] }>()

// Same memoization as flowCache for the branch-range flow: keyed on the base ref
// + range numstat + layers. The range is static until the next commit, so the
// cache is invalidated only on commit (gitRangeFlow.invalidate in use-commit).
const rangeFlowCache = new Map<string, { key: string; groups: FlowGroup[] }>()

// Commit hashes are immutable, so this cache never busts for the same commit.
// Keyed by `repoPath\nhash` so different repos' commits don't collide.
const commitFlowCache = new Map<string, { key: string; groups: FlowGroup[] }>()

/** Working-tree flow groups (shared by gitFlow + diffReading). */
export async function loadWorkingFlow(repoPath: string): Promise<FlowGroup[]> {
  const { files, stats } = await workingTreeSnapshot(repoPath)
  const layers = DEFAULT_LAYERS
  const key = flowKey(files, stats, layers)
  const cached = flowCache.get(repoPath)
  if (cached && cached.key === key) return cached.groups
  const groups = await readSourcesAndBuildFlow(repoPath, files, stats, layers)
  flowCache.set(repoPath, { key, groups })
  return groups
}

/** Branch-range flow groups + base label (shared by gitRangeFlow + diffReading). */
export async function loadRangeFlow(
  repoPath: string,
): Promise<{ groups: FlowGroup[]; base: string }> {
  const base = await gitDefaultBranch(repoPath)
  try {
    const mergeBase = await gitMergeBase(repoPath, base)
    const [files, stats] = await Promise.all([
      gitRangeChangedFilesFrom(repoPath, mergeBase),
      gitRangeNumstatFrom(repoPath, mergeBase),
    ])
    const layers = DEFAULT_LAYERS
    const key = `${base}\n${flowKey(files, stats, layers)}`
    const cached = rangeFlowCache.get(repoPath)
    if (cached && cached.key === key) return { groups: cached.groups, base }
    const groups = await readSourcesAndBuildFlow(repoPath, files, stats, layers)
    rangeFlowCache.set(repoPath, { key, groups })
    return { groups, base }
  } catch {
    return { groups: [], base }
  }
}

/** Historical commit flow groups (shared by gitCommitFlow + diffReading). */
export async function loadCommitFlow(repoPath: string, hash: string): Promise<FlowGroup[]> {
  try {
    const [files, stats] = await Promise.all([
      gitCommitFiles(repoPath, hash),
      gitCommitNumstat(repoPath, hash),
    ])
    const layers = DEFAULT_LAYERS
    const cacheKey = `${repoPath}\n${hash}`
    const key = `${hash}\n${flowKey(files, stats, layers)}`
    const cached = commitFlowCache.get(cacheKey)
    if (cached && cached.key === key) return cached.groups
    const groups = await readSourcesAndBuildFlow(repoPath, files, stats, layers)
    commitFlowCache.set(cacheKey, { key, groups })
    return groups
  } catch {
    return []
  }
}
