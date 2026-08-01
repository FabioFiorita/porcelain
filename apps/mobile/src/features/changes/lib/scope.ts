import type { DiffReadingScope } from '@/lib/daemon/procedures/changes'

/**
 * Route params are strings or arrays of strings, and a screen deep-linked with junk must still
 * render something. Anything that is not a well-formed commit scope resolves to the working
 * tree — the tab's home subject — rather than throwing on a bad URL.
 */
export function parseScope(
  scope: string | string[] | undefined,
  hash: string | string[] | undefined,
): DiffReadingScope {
  const kind = Array.isArray(scope) ? scope[0] : scope
  const at = Array.isArray(hash) ? hash[0] : hash
  if (kind === 'commit' && at !== undefined && at !== '') return { hash: at, type: 'commit' }
  return { type: 'working' }
}

/** Route params for a scope, spread into a `router.push` params object. */
export function scopeParams(scope: DiffReadingScope): { scope: string; hash: string } {
  return { hash: scope.type === 'commit' ? scope.hash : '', scope: scope.type }
}

/** A single path param. Repo-relative paths contain `/`, so they ride as a query param and
 *  never as a dynamic segment. */
export function firstParam(value: string | string[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value
  return first ?? ''
}
