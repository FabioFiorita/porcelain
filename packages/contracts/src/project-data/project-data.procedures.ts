import type { ProcedureContract } from '../procedure-contract'
import {
  companionDispositionsInputSchema,
  companionDispositionsOutputSchema,
  companionGitVisibilityInputSchema,
  companionGitVisibilityOutputSchema,
  setCompanionDispositionInputSchema,
  setCompanionDispositionOutputSchema,
  setCompanionGitVisibilityInputSchema,
  setCompanionGitVisibilityOutputSchema,
} from './project-data.contract'

const projectDataProcedureDefinitions = {
  companionDispositions: {
    kind: 'query',
    input: companionDispositionsInputSchema,
    output: companionDispositionsOutputSchema,
    errors: [],
  },
  companionGitVisibility: {
    kind: 'query',
    input: companionGitVisibilityInputSchema,
    output: companionGitVisibilityOutputSchema,
    errors: [],
  },
  setCompanionGitVisibility: {
    kind: 'mutation',
    input: setCompanionGitVisibilityInputSchema,
    output: setCompanionGitVisibilityOutputSchema,
    errors: [],
  },
  setCompanionDisposition: {
    kind: 'mutation',
    input: setCompanionDispositionInputSchema,
    output: setCompanionDispositionOutputSchema,
    errors: [],
  },
} as const

export type ProjectDataProcedureName = keyof typeof projectDataProcedureDefinitions

export const projectDataProcedures = projectDataProcedureDefinitions satisfies Record<
  ProjectDataProcedureName,
  ProcedureContract
>
