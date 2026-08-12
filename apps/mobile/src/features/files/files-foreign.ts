import type { FilesForeignDependency } from '@porcelain/client-runtime/files'
import type { QueryClient } from '@tanstack/react-query'

import { invalidateGitWorkingTree } from '@/features/git'
import {
  applySearchForeignDependencies,
  type SearchForeignDependency,
} from '@/lib/search-invalidation'

/** Map Files-owned foreign tokens onto typed Git and Search effects. */
export function applyFilesForeignDependencies(
  queryClient: QueryClient,
  environmentId: string,
  projectPath: string | null,
  dependencies: readonly FilesForeignDependency[],
): Promise<void> {
  const tasks: Promise<unknown>[] = []
  const searchDependencies: SearchForeignDependency[] = []
  for (const dependency of dependencies) {
    if (dependency.domain === 'git' && dependency.name === 'working-tree') {
      if (projectPath !== null) {
        tasks.push(invalidateGitWorkingTree(queryClient, environmentId, projectPath))
      }
      continue
    }
    if (dependency.domain === 'search') {
      searchDependencies.push(dependency)
      continue
    }
    const _exhaustive: never = dependency
    return Promise.reject(
      new Error(`unknown Files foreign dependency: ${JSON.stringify(_exhaustive)}`),
    )
  }
  if (projectPath !== null && searchDependencies.length > 0) {
    tasks.push(
      applySearchForeignDependencies(queryClient, environmentId, projectPath, searchDependencies),
    )
  }
  return Promise.all(tasks).then(() => undefined)
}
