import type { FilesForeignDependency } from '@porcelain/client-runtime/files'
import type { QueryClient } from '@tanstack/react-query'

function daemonProcedureKey(
  environmentId: string,
  name: string,
): readonly [string, string, string] {
  return ['daemon', environmentId, name]
}

/** Map Files-owned foreign tokens onto mobile's typed procedure-prefix identities. */
export function applyFilesForeignDependencies(
  queryClient: QueryClient,
  environmentId: string,
  dependencies: readonly FilesForeignDependency[],
): Promise<void> {
  const tasks: Promise<unknown>[] = []
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
    if (dependency.domain === 'search' && dependency.name === 'path-index') {
      tasks.push(
        queryClient.invalidateQueries({
          queryKey: daemonProcedureKey(environmentId, 'searchFiles'),
        }),
      )
      continue
    }
    if (dependency.domain === 'search' && dependency.name === 'content-index') {
      tasks.push(
        queryClient.invalidateQueries({
          queryKey: daemonProcedureKey(environmentId, 'searchCode'),
        }),
        queryClient.invalidateQueries({
          queryKey: daemonProcedureKey(environmentId, 'searchText'),
        }),
      )
      continue
    }
    const _exhaustive: never = dependency
    return Promise.reject(
      new Error(`unknown Files foreign dependency: ${JSON.stringify(_exhaustive)}`),
    )
  }
  return Promise.all(tasks).then(() => undefined)
}
