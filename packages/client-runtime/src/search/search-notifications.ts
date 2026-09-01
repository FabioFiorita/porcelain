import type { FilesForeignDependency } from '@porcelain/client-runtime/files'
import type { FilesChange } from '@porcelain/contracts/files'

import { searchProjectKey } from './search-queries'

/** Search families that a typed Files fact can make stale. */
export type SearchQueryEffect =
  | { readonly type: 'files'; readonly projectPath: string }
  | { readonly type: 'text'; readonly projectPath: string }
  | { readonly type: 'code'; readonly projectPath: string }

/** The Search subset of shared Files layer's cross-domain tokens. */
export type SearchForeignDependency = Extract<FilesForeignDependency, { domain: 'search' }>

export function searchFilesEffect(projectPath: string): SearchQueryEffect {
  return { type: 'files', projectPath: searchProjectKey(projectPath) }
}

export function searchTextEffect(projectPath: string): SearchQueryEffect {
  return { type: 'text', projectPath: searchProjectKey(projectPath) }
}

export function searchCodeEffect(projectPath: string): SearchQueryEffect {
  return { type: 'code', projectPath: searchProjectKey(projectPath) }
}

function effectKey(effect: SearchQueryEffect): string {
  return `${effect.type}\0${effect.projectPath}`
}

/** Deduplicate Search effects while preserving their first-seen order. */
export function dedupeSearchQueryEffects(
  effects: readonly SearchQueryEffect[],
): readonly SearchQueryEffect[] {
  const seen = new Set<string>()
  const result: SearchQueryEffect[] = []
  for (const effect of effects) {
    const key = effectKey(effect)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(effect)
  }
  return result
}

/** Exhaustive Files notification → Search freshness mapping. */
export function searchNotificationEffects(notification: FilesChange): readonly SearchQueryEffect[] {
  const projectPath = searchProjectKey(notification.projectPath)
  switch (notification.kind) {
    case 'files.scope-changed':
    case 'files.tree-changed':
      return [searchFilesEffect(projectPath)]
    case 'files.content-changed':
      return dedupeSearchQueryEffects([
        searchFilesEffect(projectPath),
        searchTextEffect(projectPath),
        searchCodeEffect(projectPath),
      ])
    default: {
      const _exhaustive: never = notification
      return _exhaustive
    }
  }
}

/** Map Files mutation freshness tokens to typed Search effects for one project. */
export function searchForeignDependencyEffects(
  projectPath: string,
  dependencies: readonly SearchForeignDependency[],
): readonly SearchQueryEffect[] {
  const effects: SearchQueryEffect[] = []
  const key = searchProjectKey(projectPath)
  for (const dependency of dependencies) {
    switch (dependency.name) {
      case 'path-index':
        effects.push(searchFilesEffect(key))
        break
      case 'content-index':
        effects.push(searchTextEffect(key), searchCodeEffect(key))
        break
      default: {
        const _exhaustive: never = dependency
        return _exhaustive
      }
    }
  }
  return dedupeSearchQueryEffects(effects)
}
