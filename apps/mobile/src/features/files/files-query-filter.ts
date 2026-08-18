import {
  dedupeFilesQueryEffects,
  type FilesQueryEffect,
  filesProjectKey,
  isFileContentQuery,
  isFilePreviewQuery,
  isFilesTreeQuery,
} from '@porcelain/client-runtime/files'
import type { QueryClient } from '@tanstack/react-query'

import { filesQueryKey, isFilesQueryKey, parseFilesQueryKey } from './files-query-key'

/** Segment-safe: self or descendant. Never a bare string prefix. */
export function filesPathIsSelfOrDescendant(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`)
}

function sameQuery(a: FilesQueryEffect & { type: 'exact' }, b: FilesQueryEffect): boolean {
  if (b.type !== 'exact') return false
  switch (a.query.name) {
    case 'tree':
      return (
        b.query.name === 'tree' &&
        a.query.projectPath === b.query.projectPath &&
        a.query.path === b.query.path &&
        a.query.showHidden === b.query.showHidden
      )
    case 'pins':
      return b.query.name === 'pins' && a.query.projectPath === b.query.projectPath
    case 'scope':
      return b.query.name === 'scope' && a.query.projectPath === b.query.projectPath
    case 'profile':
      return b.query.name === 'profile' && a.query.projectPath === b.query.projectPath
    case 'content':
      return (
        b.query.name === 'content' &&
        a.query.projectPath === b.query.projectPath &&
        a.query.path === b.query.path
      )
    case 'preview':
      return (
        b.query.name === 'preview' &&
        a.query.projectPath === b.query.projectPath &&
        a.query.path === b.query.path
      )
  }
}

export function filesQueryMatchesEffect(
  queryKey: readonly unknown[],
  effect: FilesQueryEffect,
  environmentId: string,
): boolean {
  const parsed = parseFilesQueryKey(queryKey)
  if (parsed === null || parsed.environmentId !== environmentId) return false

  switch (effect.type) {
    case 'exact':
      return sameQuery(effect, { type: 'exact', query: parsed.query })
    case 'tree-family':
      return isFilesTreeQuery(parsed.query) && parsed.query.projectPath === effect.projectPath
    case 'tree-subtree': {
      if (!isFilesTreeQuery(parsed.query) || parsed.query.projectPath !== effect.projectPath) {
        return false
      }
      if (effect.path === '.') return parsed.query.path === '.'
      return filesPathIsSelfOrDescendant(parsed.query.path, effect.path)
    }
    case 'content-subtree':
      return (
        (isFileContentQuery(parsed.query) || isFilePreviewQuery(parsed.query)) &&
        parsed.query.projectPath === effect.projectPath &&
        filesPathIsSelfOrDescendant(parsed.query.path, effect.path)
      )
    default: {
      const _exhaustive: never = effect
      return _exhaustive
    }
  }
}

export function invalidateFilesEffects(
  queryClient: QueryClient,
  environmentId: string,
  effects: readonly FilesQueryEffect[],
): Promise<void> {
  const tasks: Promise<unknown>[] = []
  for (const effect of dedupeFilesQueryEffects(effects)) {
    if (effect.type === 'exact') {
      tasks.push(
        queryClient.invalidateQueries({
          exact: true,
          queryKey: filesQueryKey(environmentId, effect.query),
        }),
      )
    } else {
      tasks.push(
        queryClient.invalidateQueries({
          predicate: (query) => filesQueryMatchesEffect(query.queryKey, effect, environmentId),
        }),
      )
    }
  }
  return Promise.all(tasks).then(() => undefined)
}

/** Invalidate only Files identities for one environment and normalized project. */
export function invalidateFilesProjectQueries(
  queryClient: QueryClient,
  environmentId: string,
  projectPath: string,
): Promise<void> {
  const projectKey = filesProjectKey(projectPath)
  return queryClient
    .invalidateQueries({
      predicate: (query) => {
        const parsed = parseFilesQueryKey(query.queryKey)
        return (
          parsed !== null &&
          parsed.environmentId === environmentId &&
          isFilesQueryKey(query.queryKey) &&
          parsed.query.projectPath === projectKey
        )
      },
    })
    .then(() => undefined)
}
