import { type GitWorkspaceQuery, gitWorkspaceQuerySchema } from '@porcelain/client-runtime/git'
import { z } from 'zod'

/**
 * Mobile's one Git cache key: environment identity first, semantic query second.
 *
 * Every Git read in this client — working tree, ranges, commits, diffs, readings, history and
 * the daemon-scoped commit-model list — is keyed this way, so one typed effect predicate can
 * decide what a mutation or notification made stale without ever naming a procedure string.
 */
const gitQueryKeySchema = z.tuple([z.literal('daemon'), z.string(), gitWorkspaceQuerySchema])

export type GitQueryKey = readonly ['daemon', string, GitWorkspaceQuery]

export function gitQueryKey(environmentId: string, query: GitWorkspaceQuery): GitQueryKey {
  return ['daemon', environmentId, query] as const
}

export function parseGitQueryKey(
  queryKey: readonly unknown[],
): { environmentId: string; query: GitWorkspaceQuery } | null {
  const parsed = gitQueryKeySchema.safeParse(queryKey)
  return parsed.success ? { environmentId: parsed.data[1], query: parsed.data[2] } : null
}

export function isGitQueryKey(queryKey: readonly unknown[]): boolean {
  return gitQueryKeySchema.safeParse(queryKey).success
}
