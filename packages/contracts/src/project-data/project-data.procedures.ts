import type { ProcedureContract } from '../procedure-contract'
import type { ProcedureName } from '../procedures/names'
import {
  companionDispositionsInputSchema,
  companionDispositionsOutputSchema,
  companionGitVisibilityInputSchema,
  companionGitVisibilityOutputSchema,
  repoNotesInputSchema,
  repoNotesOutputSchema,
  setCompanionDispositionInputSchema,
  setCompanionDispositionOutputSchema,
  setCompanionGitVisibilityInputSchema,
  setCompanionGitVisibilityOutputSchema,
  setRepoNotesInputSchema,
  setRepoNotesOutputSchema,
} from './project-data.contract'

const projectDataProcedureDefinitions = {
  repoNotes: {
    kind: 'query',
    input: repoNotesInputSchema,
    output: repoNotesOutputSchema,
  },
  setRepoNotes: {
    kind: 'mutation',
    input: setRepoNotesInputSchema,
    output: setRepoNotesOutputSchema,
  },
  companionDispositions: {
    kind: 'query',
    input: companionDispositionsInputSchema,
    output: companionDispositionsOutputSchema,
  },
  companionGitVisibility: {
    kind: 'query',
    input: companionGitVisibilityInputSchema,
    output: companionGitVisibilityOutputSchema,
  },
  setCompanionGitVisibility: {
    kind: 'mutation',
    input: setCompanionGitVisibilityInputSchema,
    output: setCompanionGitVisibilityOutputSchema,
  },
  setCompanionDisposition: {
    kind: 'mutation',
    input: setCompanionDispositionInputSchema,
    output: setCompanionDispositionOutputSchema,
  },
} as const

export type ProjectDataProcedureName = Extract<
  keyof typeof projectDataProcedureDefinitions,
  ProcedureName
>

export const projectDataProcedures = projectDataProcedureDefinitions satisfies Record<
  ProjectDataProcedureName,
  ProcedureContract
>
