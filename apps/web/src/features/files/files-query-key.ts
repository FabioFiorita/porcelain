import {
  type FilesQuery,
  filesQuerySchema,
  filesTreeQuerySchema,
} from '@porcelain/client-runtime/files'
import { type DaemonScope, daemonScopeSchema } from '@renderer/lib/daemon-scope'
import { z } from 'zod'

/**
 * Web React Query key for Files: shared Files identity + active daemon scope.
 * Procedure-name strings never appear here.
 */

/** The exact two-element key shape, parsed rather than pattern-matched. */
const filesQueryKeySchema = z.tuple([filesQuerySchema, daemonScopeSchema])
const filesTreeQueryKeySchema = z.tuple([filesTreeQuerySchema, daemonScopeSchema])

/** React Query key: shared Files identity + active daemon scope. Never procedure-name strings. */
export function filesQueryKey(
  daemon: DaemonScope,
  query: FilesQuery,
): readonly [FilesQuery, DaemonScope] {
  return [query, { host: daemon.host, version: daemon.version }] as const
}

/**
 * The Files identity and scope a React Query key carries, or null when the key is not a
 * Files key. The cache holds every domain's keys as `unknown[]`, so this is a real parse
 * of untrusted input — `safeParse` over a handful of cached entries, never filesystem rows.
 */
export function parseFilesQueryKey(
  queryKey: readonly unknown[],
): { query: FilesQuery; daemon: DaemonScope } | null {
  const parsed = filesQueryKeySchema.safeParse(queryKey)
  if (!parsed.success) return null
  const [query, daemon] = parsed.data
  return { query, daemon }
}

/** True when a React Query key is any Files identity (any project / daemon). */
export function isFilesQueryKey(queryKey: readonly unknown[]): boolean {
  return filesQueryKeySchema.safeParse(queryKey).success
}

/** True when a React Query key is a Files tree identity. */
export function isFilesTreeQueryKey(queryKey: readonly unknown[]): boolean {
  return filesTreeQueryKeySchema.safeParse(queryKey).success
}
