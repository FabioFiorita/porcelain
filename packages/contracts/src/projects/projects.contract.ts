import { z } from 'zod'

export const repoInfoSchema = z
  .object({
    path: z.string(),
    name: z.string(),
  })
  .strict()

export type ProjectInfo = z.infer<typeof repoInfoSchema>
/** Stable external alias retained until PRJ-003 removes product-boundary repo vocabulary. */
export type RepoInfo = ProjectInfo

export const browseEntrySchema = z
  .object({
    name: z.string(),
    path: z.string(),
    isRepo: z.boolean(),
  })
  .strict()

export type BrowseEntry = z.infer<typeof browseEntrySchema>

export const browseDirsOutputSchema = z
  .object({
    path: z.string(),
    parent: z.string().nullable(),
    entries: z.array(browseEntrySchema),
  })
  .strict()

export type BrowseDirsOutput = z.infer<typeof browseDirsOutputSchema>

export const openRepoPathInputSchema = z.string()
export const openRepoPathOutputSchema = repoInfoSchema
export type OpenRepoPathInput = z.infer<typeof openRepoPathInputSchema>
export type OpenRepoPathOutput = z.infer<typeof openRepoPathOutputSchema>

export const recentReposInputSchema = z
  .object({ includeWorktrees: z.boolean().default(false) })
  .strict()
  .optional()
export const recentReposOutputSchema = z.array(repoInfoSchema)
export type RecentReposInput = z.infer<typeof recentReposInputSchema>
export type RecentReposOutput = z.infer<typeof recentReposOutputSchema>

export const removeRecentRepoInputSchema = z.string()
export const removeRecentRepoOutputSchema = z.void()
export type RemoveRecentRepoInput = z.infer<typeof removeRecentRepoInputSchema>
export type RemoveRecentRepoOutput = z.infer<typeof removeRecentRepoOutputSchema>

export const browseDirsInputSchema = z.string().nullable()
export type BrowseDirsInput = z.infer<typeof browseDirsInputSchema>

/** Representative contract-valid data used by Projects boundary tests and client mocks. */
export const projectsContractFixtures = {
  openRepoPath: {
    input: '/synthetic/projects/alpha',
    output: { path: '/synthetic/projects/alpha', name: 'alpha' },
  },
  recentRepos: {
    input: undefined,
    output: [
      { path: '/synthetic/projects/alpha', name: 'alpha' },
      { path: '/synthetic/projects/beta', name: 'beta' },
    ],
  },
  removeRecentRepo: { input: '/synthetic/projects/old', output: undefined },
  browseDirs: {
    input: null,
    output: {
      path: '/synthetic/projects',
      parent: '/synthetic',
      entries: [
        { name: 'alpha', path: '/synthetic/projects/alpha', isRepo: true },
        { name: 'beta', path: '/synthetic/projects/beta', isRepo: false },
      ],
    },
  },
} as const
