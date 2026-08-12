import type { ProcedureContract } from '../procedure-contract'
import {
  browseDirsInputSchema,
  browseDirsOutputSchema,
  openRepoPathInputSchema,
  openRepoPathOutputSchema,
  recentReposInputSchema,
  recentReposOutputSchema,
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
  browseDirs: {
    kind: 'query',
    input: browseDirsInputSchema,
    output: browseDirsOutputSchema,
    errors: ['projects.not-found', 'projects.not-a-directory', 'projects.unavailable'],
  },
} as const

export type ProjectsProcedureName = keyof typeof projectsProcedureDefinitions

export const projectsProcedures = projectsProcedureDefinitions satisfies Record<
  ProjectsProcedureName,
  ProcedureContract
>
