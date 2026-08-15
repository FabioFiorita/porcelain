import type { ProcedureContract } from '../procedure-contract'
import {
  browseDirsInputSchema,
  browseDirsOutputSchema,
  createHubWorktreeInputSchema,
  hubInventoryInputSchema,
  hubInventorySchema,
  hubWorktreeSchema,
  listCanvasesInputSchema,
  listCanvasesOutputSchema,
  openRepoPathInputSchema,
  openRepoPathOutputSchema,
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
} from './projects.contract'

const projectsProcedureDefinitions = {
  openRepoPath: {
    kind: 'mutation',
    input: openRepoPathInputSchema,
    output: openRepoPathOutputSchema,
    errors: ['projects.not-found', 'projects.not-a-directory', 'projects.unavailable'],
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
} as const

export type ProjectsProcedureName = keyof typeof projectsProcedureDefinitions

export const projectsProcedures = projectsProcedureDefinitions satisfies Record<
  ProjectsProcedureName,
  ProcedureContract
>
