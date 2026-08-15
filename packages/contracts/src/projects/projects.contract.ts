import { z } from 'zod'

export const projectInfoSchema = z
  .object({
    path: z.string(),
    name: z.string(),
  })
  .strict()

export type ProjectInfo = z.infer<typeof projectInfoSchema>

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
export const openRepoPathOutputSchema = projectInfoSchema
export type OpenRepoPathInput = z.infer<typeof openRepoPathInputSchema>
export type OpenRepoPathOutput = z.infer<typeof openRepoPathOutputSchema>

export const recentReposInputSchema = z
  .object({ includeWorktrees: z.boolean().default(false) })
  .strict()
  .optional()
export const recentReposOutputSchema = z.array(projectInfoSchema)
export type RecentReposInput = z.infer<typeof recentReposInputSchema>
export type RecentReposOutput = z.infer<typeof recentReposOutputSchema>

export const removeRecentRepoInputSchema = z.string()
export const removeRecentRepoOutputSchema = z.void()
export type RemoveRecentRepoInput = z.infer<typeof removeRecentRepoInputSchema>
export type RemoveRecentRepoOutput = z.infer<typeof removeRecentRepoOutputSchema>

export const removeHubProjectInputSchema = z.string().min(1)
export const removeHubProjectOutputSchema = z.void()
export type RemoveHubProjectInput = z.infer<typeof removeHubProjectInputSchema>
export type RemoveHubProjectOutput = z.infer<typeof removeHubProjectOutputSchema>

export const removeHubWorktreeInputSchema = z
  .object({
    projectId: z.string().min(1),
    worktreeId: z.string().min(1),
  })
  .strict()
export const removeHubWorktreeOutputSchema = z.void()
export type RemoveHubWorktreeInput = z.infer<typeof removeHubWorktreeInputSchema>
export type RemoveHubWorktreeOutput = z.infer<typeof removeHubWorktreeOutputSchema>

export const browseDirsInputSchema = z.string().nullable()
export type BrowseDirsInput = z.infer<typeof browseDirsInputSchema>

/** Stable Environment identity announced by the owning daemon. */
export const environmentIdentitySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    host: z.string(),
    platform: z.string(),
    arch: z.string(),
  })
  .strict()
export type EnvironmentIdentity = z.infer<typeof environmentIdentitySchema>

/** A discovered Git checkout with an identity that survives path changes. */
export const hubWorktreeSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    path: z.string().min(1),
    name: z.string().min(1),
    branch: z.string().min(1),
    isPrimary: z.boolean(),
  })
  .strict()
export type HubWorktree = z.infer<typeof hubWorktreeSchema>

/** An Environment-local Project record and its live Git Worktrees. */
export const hubProjectSchema = z
  .object({
    id: z.string().min(1),
    environmentId: z.string().min(1),
    name: z.string().min(1),
    groupingKey: z.string().min(1),
    path: z.string().min(1),
    worktrees: z.array(hubWorktreeSchema),
  })
  .strict()
export type HubProject = z.infer<typeof hubProjectSchema>

export const hubInventorySchema = z
  .object({
    environment: environmentIdentitySchema,
    projects: z.array(hubProjectSchema),
  })
  .strict()
export type HubInventory = z.infer<typeof hubInventorySchema>

export const hubInventoryInputSchema = z.void()
export type HubInventoryInput = z.infer<typeof hubInventoryInputSchema>
export type HubInventoryOutput = HubInventory

export const createHubWorktreeInputSchema = z
  .object({
    projectId: z.string().min(1),
    branch: z.string().trim().min(1),
    baseRef: z.string().trim().min(1).optional(),
  })
  .strict()
export type CreateHubWorktreeInput = z.infer<typeof createHubWorktreeInputSchema>
export type CreateHubWorktreeOutput = HubWorktree

const hubInventoryFixture = {
  environment: {
    id: 'env-synthetic',
    name: 'synthetic',
    host: 'synthetic',
    platform: 'linux',
    arch: 'x64',
  },
  projects: [
    {
      id: 'proj-alpha',
      environmentId: 'env-synthetic',
      name: 'alpha',
      groupingKey: 'ssh://git.example/alpha',
      path: '/synthetic/projects/alpha',
      worktrees: [
        {
          id: 'wt-alpha-main',
          projectId: 'proj-alpha',
          path: '/synthetic/projects/alpha',
          name: 'alpha',
          branch: 'main',
          isPrimary: true,
        },
        {
          id: 'wt-alpha-topic',
          projectId: 'proj-alpha',
          path: '/synthetic/projects/alpha-worktrees/topic',
          name: 'topic',
          branch: 'topic',
          isPrimary: false,
        },
      ],
    },
  ],
} as const

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
  removeHubProject: { input: 'proj-alpha', output: undefined },
  removeHubWorktree: {
    input: { projectId: 'proj-alpha', worktreeId: 'wt-alpha-topic' },
    output: undefined,
  },
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
  hubInventory: { input: undefined, output: hubInventoryFixture },
  createHubWorktree: {
    input: { projectId: 'proj-alpha', branch: 'topic' },
    output: hubInventoryFixture.projects[0].worktrees[1],
  },
} as const
