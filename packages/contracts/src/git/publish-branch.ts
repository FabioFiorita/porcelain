import type { GitHead } from './git.contract'

/** Strip the remote prefix (`origin/main` → `main`, `origin/work/foo` → `work/foo`). */
export function upstreamShortName(upstream: string): string {
  const slash = upstream.indexOf('/')
  return slash === -1 ? upstream : upstream.slice(slash + 1)
}

/**
 * True when a push would create `origin/<branch>` and (re)wire tracking — either
 * there is no upstream, or the upstream's short name does not match this branch
 * (`work/foo` tracking `origin/main`). Detached HEAD is left to git.
 */
export function branchNeedsPublish(head: Pick<GitHead, 'branch' | 'upstream'>): boolean {
  if (head.branch === null) return false
  if (head.upstream === null) return true
  return upstreamShortName(head.upstream) !== head.branch
}
