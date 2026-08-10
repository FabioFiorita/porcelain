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
    errors: [],
  },
  recentRepos: {
    kind: 'query',
    input: recentReposInputSchema,
    output: recentReposOutputSchema,
    errors: [],
  },
  removeRecentRepo: {
    kind: 'mutation',
    input: removeRecentRepoInputSchema,
    output: removeRecentRepoOutputSchema,
    errors: [],
  },
  browseDirs: {
    kind: 'query',
    input: browseDirsInputSchema,
    output: browseDirsOutputSchema,
    errors: [],
  },
} as const

export type ProjectsProcedureName = keyof typeof projectsProcedureDefinitions

export const projectsProcedures = projectsProcedureDefinitions satisfies Record<
  ProjectsProcedureName,
  ProcedureContract
>
