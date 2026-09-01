import { z } from 'zod'
import { branchNameSchema } from '../git/git.contract'

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
    /** Explicit authorization to discard uncommitted files in this checkout. */
    force: z.boolean().optional(),
  })
  .strict()
export const removeHubWorktreeOutputSchema = z.void()
export type RemoveHubWorktreeInput = z.infer<typeof removeHubWorktreeInputSchema>
export type RemoveHubWorktreeOutput = z.infer<typeof removeHubWorktreeOutputSchema>

export const browseDirsInputSchema = z.string().nullable()
export type BrowseDirsInput = z.infer<typeof browseDirsInputSchema>

/**
 * Stable Environment identity announced by the owning daemon.
 *
 * `name` is the DISPLAY name and `host` is the machine. They start out equal, and a
 * nickname is what pulls them apart: two daemons with separate homes on ONE machine
 * report the same `host`, so the machine name alone cannot tell them apart.
 * `host` stays the machine and remains the cache/scope key — never overwrite it.
 */
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

/**
 * How long an Environment nickname may be. Long enough for "Fabio's Beelink (work)",
 * short enough to sit in a settings row and a Hub badge without wrapping. Input over
 * the bound is REJECTED by the contract rather than silently truncated — a name the
 * human did not choose is worse than an error they can see.
 */
export const ENVIRONMENT_NAME_MAX_LENGTH = 60

/** This daemon's Environment identity — nickname included. */
export const environmentIdentityInputSchema = z.void()
export type EnvironmentIdentityInput = z.infer<typeof environmentIdentityInputSchema>
export type EnvironmentIdentityOutput = EnvironmentIdentity

/**
 * Set this Environment's nickname. Whitespace is trimmed; an empty result CLEARS the
 * nickname and the daemon falls back to its machine-derived name, which is why the
 * input has no `min(1)` while the announced `name` does.
 */
export const renameEnvironmentInputSchema = z
  .object({ name: z.string().max(ENVIRONMENT_NAME_MAX_LENGTH) })
  .strict()
export type RenameEnvironmentInput = z.infer<typeof renameEnvironmentInputSchema>
export type RenameEnvironmentOutput = EnvironmentIdentity

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
    branch: branchNameSchema,
    baseRef: branchNameSchema.optional(),
    /** Check out this existing branch instead of creating a new one with `-b`. */
    existing: z.boolean().optional(),
  })
  .strict()
export type CreateHubWorktreeInput = z.infer<typeof createHubWorktreeInputSchema>
export type CreateHubWorktreeOutput = HubWorktree

/** Agent-authored Canvas formats. The human reviews rather than directly editing their content. */
export const canvasKindSchema = z.enum(['html', 'markdown', 'structured'])
export type CanvasKind = z.infer<typeof canvasKindSchema>

/**
 * A Canvas stored under the stable Project record. Review templates use
 * `worktreeId` as their review context; ordinary Canvases remain project-wide.
 * `worktreeId` is null for legacy/global records and promoted records that travel.
 */
export const canvasRecordSchema = z
  .object({
    id: z.string().min(1),
    worktreeId: z.string().min(1).nullable(),
    title: z.string().min(1),
    kind: canvasKindSchema,
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    /**
     * True when this Canvas was promoted into the addressed checkout's
     * `.porcelain/` Git overlay. Tracked is canonical: it wins over a
     * private record with the same id, the daemon never writes back into it,
     * and the Canvas list badges it so the human knows it travels with a clone.
     */
    tracked: z.boolean(),
  })
  .strict()
export type CanvasRecord = z.infer<typeof canvasRecordSchema>

/**
 * Pass `worktreePath` to merge the tracked overlay in that ONE checkout. Pass
 * `worktreeId` scopes records that were authored for a particular worktree context.
 */
const worktreePathSchema = z.string().min(1).optional()

export const listCanvasesInputSchema = z
  .object({
    projectId: z.string().min(1),
    worktreeId: z.string().min(1).optional(),
    worktreePath: worktreePathSchema,
  })
  .strict()
export const listCanvasesOutputSchema = z.array(canvasRecordSchema)
export type ListCanvasesInput = z.infer<typeof listCanvasesInputSchema>
export type ListCanvasesOutput = z.infer<typeof listCanvasesOutputSchema>

export const readCanvasInputSchema = z
  .object({
    projectId: z.string().min(1),
    canvasId: z.string().min(1),
    worktreePath: worktreePathSchema,
  })
  .strict()
/**
 * `content` is server-prepared for `kind: 'html'` — relative images,
 * stylesheets, and scripts are embedded (see inlineLocalAssets), while media
 * remains relative for the token-scoped streaming route. Markdown Canvases carry
 * their raw text; the Viewer's existing Markdown renderer owns presentation.
 */
export const readCanvasOutputSchema = z
  .object({ record: canvasRecordSchema, content: z.string() })
  .strict()
export type ReadCanvasInput = z.infer<typeof readCanvasInputSchema>
export type ReadCanvasOutput = z.infer<typeof readCanvasOutputSchema>

/**
 * A short-lived capability for the `GET /canvas/<token>` route the Viewer's
 * sandboxed iframe navigates to — a plain iframe `src` carries no
 * Authorization header, so the URL itself must carry the credential. Narrow
 * on purpose: one Project+Canvas, minutes-long TTL, never the admin token.
 */
export const mintCanvasAccessTokenInputSchema = z
  .object({
    projectId: z.string().min(1),
    canvasId: z.string().min(1),
    worktreePath: worktreePathSchema,
  })
  .strict()
export const mintCanvasAccessTokenOutputSchema = z.object({ token: z.string().min(1) }).strict()
export type MintCanvasAccessTokenInput = z.infer<typeof mintCanvasAccessTokenInputSchema>
export type MintCanvasAccessTokenOutput = z.infer<typeof mintCanvasAccessTokenOutputSchema>

/** Promoted Project navigation defaults — `<repo>/.porcelain/project.json`. */
const currentProjectOverridesSchema = z
  .object({
    /** Repo-relative paths shared as project defaults. */
    hiddenPaths: z.array(z.string()),
    pinnedPaths: z.array(z.string()),
  })
  .strict()

/** Read old documents without retaining the lifecycle field now owned by trusted Actions. */
export const projectOverridesSchema = z.preprocess((value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  const { worktrees: _retired, ...current } = value as Record<string, unknown>
  return current
}, currentProjectOverridesSchema)
export type ProjectOverrides = z.infer<typeof projectOverridesSchema>

/**
 * Promotion moves ONE private Canvas bundle into `path`'s Git overlay. `path`
 * is the explicit target — there is no "current" checkout to guess at, and an
 * ambiguous or foreign path is rejected rather than resolved. `worktreeId`, when
 * given, must name the same checkout; it lets a client prove the path it cached
 * still belongs to the Worktree it thinks it does.
 *
 * Promotion writes plain files. It never runs `git add` or commits — the human
 * or agent decides when the promoted Canvas enters history.
 */
export const promoteCanvasInputSchema = z
  .object({
    projectId: z.string().min(1),
    canvasId: z.string().min(1),
    path: z.string().min(1),
    worktreeId: z.string().min(1).optional(),
  })
  .strict()
export const promoteCanvasOutputSchema = z
  .object({ record: canvasRecordSchema, bundlePath: z.string().min(1) })
  .strict()
export type PromoteCanvasInput = z.infer<typeof promoteCanvasInputSchema>
export type PromoteCanvasOutput = z.infer<typeof promoteCanvasOutputSchema>

/** Track the current project defaults. Every field replaces wholesale; omitted fields keep. */
export const promoteOverridesInputSchema = z
  .object({
    projectId: z.string().min(1),
    path: z.string().min(1),
    hiddenPaths: z.array(z.string()).optional(),
    pinnedPaths: z.array(z.string()).optional(),
  })
  .strict()
export type PromoteOverridesInput = z.infer<typeof promoteOverridesInputSchema>
/** The whole tracked document, not a delta — the caller sees exactly what is on disk. */
export type PromoteOverridesOutput = ProjectOverrides

/** What one checkout's `.porcelain/` overlay currently carries — one entry per channel. */
export const listOverlayInputSchema = z.object({ path: z.string().min(1) }).strict()
export const listOverlayOutputSchema = z
  .object({
    path: z.string().min(1),
    /** False when `.porcelain/` does not exist — the untouched, never-promoted repo. */
    present: z.boolean(),
    canvases: z.array(canvasRecordSchema),
    overrides: projectOverridesSchema.nullable(),
  })
  .strict()
export type ListOverlayInput = z.infer<typeof listOverlayInputSchema>
export type ListOverlayOutput = z.infer<typeof listOverlayOutputSchema>

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
  environmentIdentity: { input: undefined, output: hubInventoryFixture.environment },
  renameEnvironment: {
    input: { name: 'Beelink (work)' },
    output: { ...hubInventoryFixture.environment, name: 'Beelink (work)' },
  },
  createHubWorktree: {
    input: { projectId: 'proj-alpha', branch: 'topic' },
    output: hubInventoryFixture.projects[0].worktrees[1],
  },
  listCanvases: {
    input: { projectId: 'proj-alpha' },
    output: [
      {
        id: 'canvas-intent',
        worktreeId: 'wt-alpha-main',
        title: 'Intent',
        kind: 'html',
        createdAt: '2026-08-15T00:00:00.000Z',
        updatedAt: '2026-08-15T00:00:00.000Z',
        tracked: false,
      },
    ],
  },
  readCanvas: {
    input: { projectId: 'proj-alpha', canvasId: 'canvas-intent' },
    output: {
      record: {
        id: 'canvas-intent',
        worktreeId: 'wt-alpha-main',
        title: 'Intent',
        kind: 'html',
        createdAt: '2026-08-15T00:00:00.000Z',
        updatedAt: '2026-08-15T00:00:00.000Z',
        tracked: false,
      },
      content: '<p>hi</p>',
    },
  },
  mintCanvasAccessToken: {
    input: { projectId: 'proj-alpha', canvasId: 'canvas-intent' },
    output: { token: 'synthetic-token' },
  },
  promoteCanvas: {
    input: {
      projectId: 'proj-alpha',
      canvasId: 'canvas-intent',
      path: '/synthetic/projects/alpha',
    },
    output: {
      record: {
        id: 'canvas-intent',
        // Null once tracked: a Worktree id is Environment-local, and a promoted
        // Canvas travels to clones where it would name nothing.
        worktreeId: null,
        title: 'Intent',
        kind: 'html',
        createdAt: '2026-08-15T00:00:00.000Z',
        updatedAt: '2026-08-15T00:00:00.000Z',
        tracked: true,
      },
      bundlePath: '/synthetic/projects/alpha/.porcelain/canvases/canvas-intent',
    },
  },
  promoteOverrides: {
    input: {
      projectId: 'proj-alpha',
      path: '/synthetic/projects/alpha',
      hiddenPaths: ['apps/legacy'],
      pinnedPaths: ['apps/web'],
    },
    output: { hiddenPaths: ['apps/legacy'], pinnedPaths: ['apps/web'] },
  },
  listOverlay: {
    input: { path: '/synthetic/projects/alpha' },
    output: {
      path: '/synthetic/projects/alpha',
      present: true,
      canvases: [
        {
          id: 'canvas-intent',
          worktreeId: null,
          title: 'Intent',
          kind: 'html',
          createdAt: '2026-08-15T00:00:00.000Z',
          updatedAt: '2026-08-15T00:00:00.000Z',
          tracked: true,
        },
      ],
      overrides: { hiddenPaths: ['apps/legacy'], pinnedPaths: ['apps/web'] },
    },
  },
} as const
