/**
 * The git read/mutation surface, one seam for daemon callers.
 *
 * Each module owns one concern; this file only re-exports so existing
 * `from '…/git/git'` imports keep their single public entry point.
 *
 * - `git-exec`        spawn chokepoint + error surfacing + identity reuse
 * - `git-files`       tracked/finder file listings (stale-while-revalidate)
 * - `git-log`         log/show/status/numstat reads
 * - `git-refs`        HEAD/branches/worktrees/default+compare base resolution
 * - `git-stage`       staging/index mutations and commit
 * - `git-sync`        quick commands, suggestions, push
 * - `git-search`      grep and the Search tab's code search
 * - `git-diff-file`   per-file working-tree diff (binary/image aware)
 * - `git-fingerprints` content fingerprints behind reviewed marks
 * - `git-ranges`      merge-base range reads for branch review
 */
export * from './git-exec'
export * from './git-files'
export * from './git-log'
export * from './git-refs'
export * from './git-stage'
export * from './git-sync'
export * from './git-search'
export * from './git-diff-file'
export * from './git-fingerprints'
export * from './git-ranges'
