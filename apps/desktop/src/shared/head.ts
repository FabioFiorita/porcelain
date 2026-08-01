/**
 * What a checkout's HEAD points at. Node-free leaf in `src/shared/` (like
 * evidence-check) so the daemon parses it and the renderer renders it without
 * runtime-importing `@backend/*`.
 *
 * `branch` is the CHECKOUT TARGET — null when HEAD is detached — so callers that
 * compare against a branch list (the branch switcher's current-branch mark) can
 * never be fooled by a label. Anything that only DISPLAYS goes through
 * `headLabel`, which is why nothing invents its own "(detached)" string.
 */
export interface HeadRef {
  branch: string | null
  /** Short sha of the detached commit; null while a branch is checked out. */
  detachedSha: string | null
}

/** The one human-readable rendering of a HEAD: a branch name, or `detached @ <sha>`. */
export function headLabel(head: HeadRef): string {
  if (head.branch !== null) return head.branch
  return head.detachedSha !== null ? `detached @ ${head.detachedSha}` : 'detached'
}
