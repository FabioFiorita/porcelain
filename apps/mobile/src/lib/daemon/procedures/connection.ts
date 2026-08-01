import { z } from 'zod'

import { defineMutation, defineQuery } from '../procedure'

const repoSchema = z.object({ path: z.string(), name: z.string() })

/**
 * The identity fields are the version-skew canary, not a contract — every one stays optional
 * so a daemon that stops sending `arch` degrades a label instead of failing the probe.
 */
export const daemonInfoQuery = defineQuery<
  void,
  { version: string; host?: string; platform?: string; arch?: string }
>(
  'daemonInfo',
  z.object({
    version: z.string(),
    host: z.string().optional(),
    platform: z.string().optional(),
    arch: z.string().optional(),
  }),
)

export const recentReposQuery = defineQuery<
  { includeWorktrees: boolean },
  { path: string; name: string }[]
>('recentRepos', z.array(repoSchema))

export const openRepoPathMutation = defineMutation<string, { path: string; name: string }>(
  'openRepoPath',
  repoSchema,
)

export const browseDirsQuery = defineQuery<
  string | null,
  {
    path: string
    parent: string | null
    entries: { name: string; path: string; isRepo: boolean }[]
  }
>(
  'browseDirs',
  z.object({
    path: z.string(),
    parent: z.string().nullable(),
    entries: z.array(z.object({ name: z.string(), path: z.string(), isRepo: z.boolean() })),
  }),
)

export const removeRecentRepoMutation = defineMutation<string, void>('removeRecentRepo', z.void())

export const revokeCurrentClientMutation = defineMutation<void, void>(
  'revokeCurrentClient',
  z.void(),
)
