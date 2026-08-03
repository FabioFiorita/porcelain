import type { ChangedFile, DiffStat } from './diff'
import { gitNumstat, gitStatus } from './git'

/** One working-tree read shared by every poll procedure on a tick: the porcelain
 *  status and the `diff HEAD` numstat, fetched together. */
export interface WorkingTreeSnapshot {
  files: ChangedFile[]
  stats: DiffStat[]
}

/**
 * TTL for the shared snapshot. Strictly under the 3s renderer poll so no tick
 * ever sees data older than the previous tick, but long enough to coalesce the
 * two-to-three poll procedures firing within one tick onto a single git spawn
 * pair. If the poll interval ever drops below ~1.5s, shrink this with it.
 */
const TTL = 1000

interface Entry {
  at: number
  promise: Promise<WorkingTreeSnapshot>
}

const cache = new Map<string, Entry>()

function defaultFetch(repoPath: string): () => Promise<WorkingTreeSnapshot> {
  return async () => {
    const [files, stats] = await Promise.all([gitStatus(repoPath), gitNumstat(repoPath)])
    return { files, stats }
  }
}

/**
 * Coalesce concurrent callers within one poll tick onto ONE in-flight git read,
 * then serve the result for a short TTL. A caller that arrives while the promise
 * is still pending, or within TTL of its start, gets the same promise; otherwise
 * a fresh fetch replaces the entry. A rejected fetch evicts its entry so errors
 * are never cached for the TTL. `fetch` is injectable for tests (the impure edge,
 * per the `tailnet.ts` pattern).
 */
export function workingTreeSnapshot(
  repoPath: string,
  fetch: () => Promise<WorkingTreeSnapshot> = defaultFetch(repoPath),
): Promise<WorkingTreeSnapshot> {
  const cached = cache.get(repoPath)
  if (cached && Date.now() - cached.at < TTL) return cached.promise
  const promise = fetch()
  const entry: Entry = { at: Date.now(), promise }
  cache.set(repoPath, entry)
  promise.catch(() => {
    // Evict a rejected fetch so the next caller re-fetches instead of re-throwing
    // the cached rejection — but only if this entry is still the current one.
    if (cache.get(repoPath) === entry) cache.delete(repoPath)
  })
  return promise
}

/** Drop the snapshot for a repo so the next caller re-fetches. Used by mutating
 *  procedures (stage/commit/write/quick command) that want their invalidated
 *  query's immediate refetch to see post-mutation state, not a ≤1s-old snapshot. */
export function clearWorkingTreeSnapshot(repoPath: string): void {
  cache.delete(repoPath)
}
