import type { ProcedureContract } from '../procedure-contract'
import {
  browseDirsInputSchema,
  browseDirsOutputSchema,
  createHubWorktreeInputSchema,
  environmentIdentityInputSchema,
  environmentIdentitySchema,
  hubInventoryInputSchema,
  hubInventorySchema,
  hubWorktreeSchema,
  listCanvasesInputSchema,
  listCanvasesOutputSchema,
  listOverlayInputSchema,
  listOverlayOutputSchema,
  mintCanvasAccessTokenInputSchema,
  mintCanvasAccessTokenOutputSchema,
  openRepoPathInputSchema,
  openRepoPathOutputSchema,
  projectOverridesSchema,
  promoteCanvasInputSchema,
  promoteCanvasOutputSchema,
  promoteOverridesInputSchema,
  readCanvasInputSchema,
  readCanvasOutputSchema,
  recentReposInputSchema,
  recentReposOutputSchema,
  removeHubProjectInputSchema,
  removeHubProjectOutputSchema,
  removeHubWorktreeInputSchema,
  removeHubWorktreeOutputSchema,
  removeRecentRepoInputSchema,
  removeRecentRepoOutputSchema,
  renameEnvironmentInputSchema,
} from './projects.contract'

const projectsProcedureDefinitions = {
  openRepoPath: {
    kind: 'mutation',
    input: openRepoPathInputSchema,
    output: openRepoPathOutputSchema,
    errors: [
      'projects.not-found',
      'projects.not-a-directory',
      'projects.unavailable',
      'projects.dev-repo-forbidden',
    ],
  },
  recentRepos: {
    kind: 'query',
    input: recentReposInputSchema,
    output: recentReposOutputSchema,
    errors: ['projects.unavailable'],
  },
  removeRecentRepo: {
    kind: 'mutation',
    input: removeRecentRepoInputSchema,
    output: removeRecentRepoOutputSchema,
    errors: ['projects.unavailable'],
  },
  removeHubProject: {
    kind: 'mutation',
    input: removeHubProjectInputSchema,
    output: removeHubProjectOutputSchema,
    errors: ['projects.not-found', 'projects.unavailable'],
  },
  removeHubWorktree: {
    kind: 'mutation',
    input: removeHubWorktreeInputSchema,
    output: removeHubWorktreeOutputSchema,
    errors: [
      'projects.not-found',
      'projects.unavailable',
      'git.not-a-repository',
      'git.worktree-conflict',
    ],
  },
  browseDirs: {
    kind: 'query',
    input: browseDirsInputSchema,
    output: browseDirsOutputSchema,
    errors: ['projects.not-found', 'projects.not-a-directory', 'projects.unavailable'],
  },
  hubInventory: {
    kind: 'query',
    input: hubInventoryInputSchema,
    output: hubInventorySchema,
    errors: ['projects.unavailable'],
  },
  environmentIdentity: {
    kind: 'query',
    input: environmentIdentityInputSchema,
    output: environmentIdentitySchema,
    errors: ['projects.unavailable'],
  },
  renameEnvironment: {
    kind: 'mutation',
    input: renameEnvironmentInputSchema,
    output: environmentIdentitySchema,
    errors: ['projects.unavailable'],
  },
  createHubWorktree: {
    kind: 'mutation',
    input: createHubWorktreeInputSchema,
    output: hubWorktreeSchema,
    errors: [
      'projects.not-found',
      'projects.unavailable',
      'git.not-a-repository',
      'git.branch-already-exists',
      'git.worktree-conflict',
    ],
  },
  listCanvases: {
    kind: 'query',
    input: listCanvasesInputSchema,
    output: listCanvasesOutputSchema,
    errors: ['canvas.unavailable'],
  },
  readCanvas: {
    kind: 'query',
    input: readCanvasInputSchema,
    output: readCanvasOutputSchema,
    errors: ['canvas.not-found', 'canvas.unavailable'],
  },
  mintCanvasAccessToken: {
    kind: 'mutation',
    input: mintCanvasAccessTokenInputSchema,
    output: mintCanvasAccessTokenOutputSchema,
    errors: ['canvas.not-found', 'canvas.unavailable'],
  },
  promoteCanvas: {
    kind: 'mutation',
    input: promoteCanvasInputSchema,
    output: promoteCanvasOutputSchema,
    errors: ['canvas.not-found', 'canvas.unavailable', 'projects.overlay-target-invalid'],
  },
  promoteOverrides: {
    kind: 'mutation',
    input: promoteOverridesInputSchema,
    output: projectOverridesSchema,
    errors: ['projects.unavailable', 'projects.overlay-target-invalid'],
  },
  listOverlay: {
    kind: 'query',
    input: listOverlayInputSchema,
    output: listOverlayOutputSchema,
    errors: ['projects.unavailable'],
  },
} as const

export type ProjectsProcedureName = keyof typeof projectsProcedureDefinitions

export const projectsProcedures = projectsProcedureDefinitions satisfies Record<
  ProjectsProcedureName,
  ProcedureContract
>
