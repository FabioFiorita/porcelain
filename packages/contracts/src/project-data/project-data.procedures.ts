import type { ProcedureContract } from '../procedure-contract'
import {
  companionDispositionsInputSchema,
  companionDispositionsOutputSchema,
  companionGitVisibilityInputSchema,
  companionGitVisibilityOutputSchema,
  migrateCompanionInputSchema,
  migrateCompanionOutputSchema,
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
  // `request.invalid` is the ambiguous-target outcome: a `path` that is not a live
  // checkout of `projectId` is rejected rather than guessed at (#18's explicit-target
  // rule), and the system error already carries exactly that meaning on the wire.
  migrateCompanion: {
    kind: 'mutation',
    input: migrateCompanionInputSchema,
    output: migrateCompanionOutputSchema,
    errors: ['request.invalid'],
  },
} as const

export type ProjectDataProcedureName = keyof typeof projectDataProcedureDefinitions

export const projectDataProcedures = projectDataProcedureDefinitions satisfies Record<
  ProjectDataProcedureName,
  ProcedureContract
>
