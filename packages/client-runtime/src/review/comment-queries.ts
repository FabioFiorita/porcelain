/**
 * Typed Review-comments query identity (RVC-002).
 *
 * Adapters compose this with daemon/environment identity into a TanStack Query key.
 * It is the only Review-comments server-state identity; procedure names and cache
 * strings stay out. Wire inputs still use `repoPath`; this identity uses product
 * language `projectPath` (Board pattern).
 */

export type ReviewCommentsQuery = {
  readonly domain: 'review'
  readonly name: 'comments'
  readonly projectPath: string
}

/** Build the sole Review-comments query identity for a Project path. */
export function reviewCommentsQuery(projectPath: string): ReviewCommentsQuery {
  return { domain: 'review', name: 'comments', projectPath }
}
