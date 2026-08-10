import type { ProcedureContract } from '../procedure-contract'
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
    errors: [],
  },
  setRepoNotes: {
    kind: 'mutation',
    input: setRepoNotesInputSchema,
    output: setRepoNotesOutputSchema,
    errors: [],
  },
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
