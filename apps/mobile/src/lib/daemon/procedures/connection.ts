import { browseDirsOutputSchema, repoInfoSchema } from '@porcelain/contracts/projects'
import { daemonInfoOutputSchema } from '@porcelain/contracts/remote'
import { z } from 'zod'

import { defineMutation, defineQuery } from '../procedure'

export type DaemonInfo = z.infer<typeof daemonInfoOutputSchema>
export type BrowseDirsResult = z.infer<typeof browseDirsOutputSchema>
export type RepoInfo = z.infer<typeof repoInfoSchema>

export const daemonInfoQuery = defineQuery<void, DaemonInfo>('daemonInfo', daemonInfoOutputSchema)

export const recentReposQuery = defineQuery<{ includeWorktrees: boolean }, RepoInfo[]>(
  'recentRepos',
  z.array(repoInfoSchema),
)

export const openRepoPathMutation = defineMutation<string, RepoInfo>('openRepoPath', repoInfoSchema)

export const browseDirsQuery = defineQuery<string | null, BrowseDirsResult>(
  'browseDirs',
  browseDirsOutputSchema,
)

export const removeRecentRepoMutation = defineMutation<string, void>('removeRecentRepo', z.void())

export const revokeCurrentClientMutation = defineMutation<void, void>(
  'revokeCurrentClient',
  z.void(),
)

export { repoInfoSchema }
