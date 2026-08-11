import {
  dedupeFilesQueryEffects,
  type FilesQueryEffect,
  isFileContentQuery,
  isFilePreviewQuery,
  isFilesTreeQuery,
} from '@porcelain/client-runtime/files'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import type { QueryClient } from '@tanstack/react-query'
import { filesQueryKey, isFilesQueryKey, parseFilesQueryKey } from './files-query-key'

/** Segment-safe: self or descendant. Never bare string prefix (rejects 'a' matching 'ab'). */
export function filesPathIsSelfOrDescendant(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`)
}

function daemonScopeEquals(a: DaemonScope, b: DaemonScope): boolean {
  return a.host === b.host && a.version === b.version
}

export function filesQueryMatchesEffect(
  queryKey: readonly unknown[],
  effect: FilesQueryEffect,
  daemon: DaemonScope,
): boolean {
  const parsed = parseFilesQueryKey(queryKey)
  if (parsed === null) return false
  if (!daemonScopeEquals(parsed.daemon, daemon)) return false

  switch (effect.type) {
    case 'exact': {
      const expected = filesQueryKey(daemon, effect.query)
      // Both sides are canonical: `parsed.query` comes out of the identity schema and
      // `expected[0]` out of the identity constructors, so field order cannot diverge.
      return (
        JSON.stringify(parsed.query) === JSON.stringify(expected[0]) &&
        daemonScopeEquals(parsed.daemon, expected[1])
      )
    }
    case 'tree-family':
      return isFilesTreeQuery(parsed.query) && parsed.query.projectPath === effect.projectPath
    case 'tree-subtree': {
      if (!isFilesTreeQuery(parsed.query)) return false
      if (parsed.query.projectPath !== effect.projectPath) return false
      // `'.'` root is only self — never a prefix of all trees.
      if (effect.path === '.') return parsed.query.path === '.'
      return filesPathIsSelfOrDescendant(parsed.query.path, effect.path)
    }
    case 'content-subtree': {
      if (!isFileContentQuery(parsed.query) && !isFilePreviewQuery(parsed.query)) return false
      if (parsed.query.projectPath !== effect.projectPath) return false
      return filesPathIsSelfOrDescendant(parsed.query.path, effect.path)
    }
    default: {
      const _exhaustive: never = effect
      return _exhaustive
    }
  }
}

/** Invalidate every Files cache entry matching the given effects under the active daemon. */
export function invalidateFilesEffects(
  queryClient: QueryClient,
  daemon: DaemonScope,
  effects: readonly FilesQueryEffect[],
): Promise<void> {
  const deduped = dedupeFilesQueryEffects(effects)
  const tasks: Promise<void>[] = []
  for (const effect of deduped) {
    if (effect.type === 'exact') {
      tasks.push(
        queryClient.invalidateQueries({
          queryKey: filesQueryKey(daemon, effect.query),
          exact: true,
        }),
      )
      continue
    }
    tasks.push(
      queryClient.invalidateQueries({
        predicate: (query) => filesQueryMatchesEffect(query.queryKey, effect, daemon),
      }),
    )
  }
  return Promise.all(tasks).then(() => undefined)
}

/** Invalidate every Files cache entry (session/project recovery). */
export function invalidateAllFilesQueries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => isFilesQueryKey(query.queryKey),
  })
}
