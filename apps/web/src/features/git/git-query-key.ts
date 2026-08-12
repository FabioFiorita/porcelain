import { type GitWorkspaceQuery, gitWorkspaceQuerySchema } from '@porcelain/client-runtime/git'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { daemonScopeSchema } from '@renderer/lib/daemon-scope'
import { z } from 'zod'

/** Web's exact Git key: semantic identity first, daemon scope second. */
const gitQueryKeySchema = z.tuple([gitWorkspaceQuerySchema, daemonScopeSchema])

export type GitQueryKey = readonly [GitWorkspaceQuery, DaemonScope]

export function gitQueryKey(daemon: DaemonScope, query: GitWorkspaceQuery): GitQueryKey {
  return [query, { host: daemon.host, version: daemon.version }] as const
}

export function parseGitQueryKey(
  queryKey: readonly unknown[],
): { query: GitWorkspaceQuery; daemon: DaemonScope } | null {
  const parsed = gitQueryKeySchema.safeParse(queryKey)
  return parsed.success ? { daemon: parsed.data[1], query: parsed.data[0] } : null
}

export function isGitQueryKey(queryKey: readonly unknown[]): boolean {
  return gitQueryKeySchema.safeParse(queryKey).success
}
