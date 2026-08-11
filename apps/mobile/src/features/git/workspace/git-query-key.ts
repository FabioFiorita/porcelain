import { type GitWorkspaceQuery, gitWorkspaceQuerySchema } from '@porcelain/client-runtime/git'
import { z } from 'zod'

/** Mobile's exact Git workspace key: environment identity first, semantic query second. */
const gitWorkspaceQueryKeySchema = z.tuple([
  z.literal('daemon'),
  z.string(),
  gitWorkspaceQuerySchema,
])

export type GitWorkspaceQueryKey = readonly ['daemon', string, GitWorkspaceQuery]

export function gitWorkspaceQueryKey(
  environmentId: string,
  query: GitWorkspaceQuery,
): GitWorkspaceQueryKey {
  return ['daemon', environmentId, query] as const
}

export function parseGitWorkspaceQueryKey(
  queryKey: readonly unknown[],
): { environmentId: string; query: GitWorkspaceQuery } | null {
  const parsed = gitWorkspaceQueryKeySchema.safeParse(queryKey)
  return parsed.success ? { environmentId: parsed.data[1], query: parsed.data[2] } : null
}

export function isGitWorkspaceQueryKey(queryKey: readonly unknown[]): boolean {
  return gitWorkspaceQueryKeySchema.safeParse(queryKey).success
}
