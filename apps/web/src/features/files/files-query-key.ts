import type { FilesQuery } from '@porcelain/client-runtime/files'

/**
 * Web React Query key for Files: FIL-004 identity + active daemon scope.
 * Procedure-name strings never appear here.
 */

export type FilesDaemonScope = {
  readonly host: string | null
  readonly version: string | null
}

/** React Query key: FIL-004 identity + active daemon scope. Never procedure-name strings. */
export function filesQueryKey(
  daemon: FilesDaemonScope,
  query: FilesQuery,
): readonly [FilesQuery, FilesDaemonScope] {
  return [query, { host: daemon.host, version: daemon.version }] as const
}

/** True when a React Query key is any Files identity (any project / daemon). */
export function isFilesQueryKey(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0]
  return (
    typeof head === 'object' &&
    head !== null &&
    'domain' in head &&
    (head as { domain: unknown }).domain === 'files'
  )
}

/** True when a React Query key is a Files tree identity. */
export function isFilesTreeQueryKey(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0]
  return (
    typeof head === 'object' &&
    head !== null &&
    'domain' in head &&
    (head as { domain: unknown }).domain === 'files' &&
    'name' in head &&
    (head as { name: unknown }).name === 'tree'
  )
}
