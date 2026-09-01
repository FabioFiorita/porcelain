import {
  projectDataProcedures,
  type SetCompanionDispositionInput,
  type SetCompanionGitVisibilityInput,
} from '@porcelain/contracts/project-data'
import {
  type ProjectDataQuery,
  projectDataDispositionsQuery,
  projectDataProjectKey,
  projectDataVisibilityQuery,
} from './project-data-queries'

/**
 * Project Data mutation consequence definitions.
 *
 * Each entry binds exactly one live Project Data contract procedure and the Project Data identities it
 * makes stale. Mutations are refetch-only — no optimistic field, no Git/Review identities.
 * Cross-domain cache refresh stays in the feature adapters.
 */

type ProjectDataMutationProcedureName = 'setCompanionGitVisibility' | 'setCompanionDisposition'

export type ProjectDataMutationDefinition<
  TName extends ProjectDataMutationProcedureName,
  TInput,
> = {
  readonly procedure: (typeof projectDataProcedures)[TName]
  readonly procedureName: TName
  readonly affectedQueries: (input: TInput) => readonly ProjectDataQuery[]
  readonly requiresAuthoritativeRefetch: true
}

export const projectDataMutations = {
  setCompanionGitVisibility: {
    procedure: projectDataProcedures.setCompanionGitVisibility,
    procedureName: 'setCompanionGitVisibility',
    affectedQueries: (input: SetCompanionGitVisibilityInput): readonly ProjectDataQuery[] => {
      const key = projectDataProjectKey(input.repoPath)
      return [projectDataVisibilityQuery(key), projectDataDispositionsQuery(key)]
    },
    requiresAuthoritativeRefetch: true,
  },
  setCompanionDisposition: {
    procedure: projectDataProcedures.setCompanionDisposition,
    procedureName: 'setCompanionDisposition',
    affectedQueries: (input: SetCompanionDispositionInput): readonly ProjectDataQuery[] => {
      const key = projectDataProjectKey(input.repoPath)
      return [projectDataDispositionsQuery(key), projectDataVisibilityQuery(key)]
    },
    requiresAuthoritativeRefetch: true,
  },
} as const satisfies {
  readonly setCompanionGitVisibility: ProjectDataMutationDefinition<
    'setCompanionGitVisibility',
    SetCompanionGitVisibilityInput
  >
  readonly setCompanionDisposition: ProjectDataMutationDefinition<
    'setCompanionDisposition',
    SetCompanionDispositionInput
  >
}

export type ProjectDataMutation = (typeof projectDataMutations)[keyof typeof projectDataMutations]
