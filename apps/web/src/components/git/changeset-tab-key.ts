import type { DiffReadingScope } from '@renderer/features/git'

/**
 * Encode a review scope into the tab's path key (and parse it back).
 *
 * The Branch scope carries its comparison base, so two bases open as two tabs
 * rather than one tab whose contents silently change under a restored session.
 * A bare `branch` (older sessions, and the default pick) still parses.
 *
 * This navigation-only helper intentionally stays separate from ChangesetView:
 * the shell and sidebar need tab keys without pulling the full reading surface
 * into their initial bundle.
 */
export function changesetTabKey(scope: DiffReadingScope): string {
  if (scope.type === 'commit') return `commit:${scope.hash}`
  if (scope.type === 'branch' && scope.base !== undefined) return `branch:${scope.base}`
  return scope.type
}

export function parseChangesetTabKey(path: string): DiffReadingScope {
  if (path === 'working') return { type: 'working' }
  if (path === 'branch') return { type: 'branch' }
  if (path.startsWith('branch:')) return { type: 'branch', base: path.slice('branch:'.length) }
  if (path.startsWith('commit:')) return { type: 'commit', hash: path.slice('commit:'.length) }
  // Defensive fallback — malformed navigation should not blank the view.
  return { type: 'working' }
}
