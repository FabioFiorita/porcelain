import { type GitWorkspaceQuery, gitWorkspaceQuerySchema } from '@porcelain/client-runtime/git'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { daemonScopeSchema } from '@renderer/lib/daemon-scope'
import { z } from 'zod'

/** Web's exact Git workspace key: semantic identity first, daemon scope second. */
const gitWorkspaceQueryKeySchema = z.tuple([gitWorkspaceQuerySchema, daemonScopeSchema])

export type GitWorkspaceQueryKey = readonly [GitWorkspaceQuery, DaemonScope]

export function gitWorkspaceQueryKey(
  daemon: DaemonScope,
  query: GitWorkspaceQuery,
): GitWorkspaceQueryKey {
  return [query, { host: daemon.host, version: daemon.version }] as const
}

export function parseGitWorkspaceQueryKey(
  queryKey: readonly unknown[],
): { query: GitWorkspaceQuery; daemon: DaemonScope } | null {
  const parsed = gitWorkspaceQueryKeySchema.safeParse(queryKey)
  return parsed.success ? { daemon: parsed.data[1], query: parsed.data[0] } : null
}

export function isGitWorkspaceQueryKey(queryKey: readonly unknown[]): boolean {
  return gitWorkspaceQueryKeySchema.safeParse(queryKey).success
}
