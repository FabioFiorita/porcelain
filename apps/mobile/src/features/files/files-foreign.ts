import type { FilesForeignDependency } from '@porcelain/client-runtime/files'
import type { QueryClient } from '@tanstack/react-query'

import {
  applySearchForeignDependencies,
  type SearchForeignDependency,
} from '@/lib/search-invalidation'

function daemonProcedureKey(
  environmentId: string,
  name: string,
): readonly [string, string, string] {
  return ['daemon', environmentId, name]
}

/** Map Files-owned foreign tokens onto Mobile Git keys and typed Search effects. */
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
      tasks.push(
        queryClient.invalidateQueries({ queryKey: daemonProcedureKey(environmentId, 'gitFlow') }),
        queryClient.invalidateQueries({
          queryKey: daemonProcedureKey(environmentId, 'gitDiffFile'),
        }),
      )
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
