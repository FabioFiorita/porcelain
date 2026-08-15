import type { ProcedureContract } from '../procedure-contract'
import {
  actionsInputSchema,
  actionsOutputSchema,
  addActionInputSchema,
  addActionOutputSchema,
  deleteActionInputSchema,
  deleteActionOutputSchema,
  moveActionInputSchema,
  moveActionOutputSchema,
  prepareActionRunInputSchema,
  prepareActionRunOutputSchema,
  trustActionsInputSchema,
  trustActionsOutputSchema,
  updateActionInputSchema,
  updateActionOutputSchema,
} from './actions.contract'

const actionsProcedureDefinitions = {
  actions: {
    kind: 'query',
    input: actionsInputSchema,
    output: actionsOutputSchema,
    errors: ['actions.unavailable'],
  },
  trustActions: {
    kind: 'mutation',
    input: trustActionsInputSchema,
    output: trustActionsOutputSchema,
    errors: ['actions.unavailable'],
  },
  addAction: {
    kind: 'mutation',
    input: addActionInputSchema,
    output: addActionOutputSchema,
    errors: ['actions.unavailable', 'request.invalid'],
  },
  updateAction: {
    kind: 'mutation',
    input: updateActionInputSchema,
    output: updateActionOutputSchema,
    errors: ['actions.unavailable', 'actions.not-found', 'request.invalid'],
  },
  moveAction: {
    kind: 'mutation',
    input: moveActionInputSchema,
    output: moveActionOutputSchema,
    errors: ['actions.unavailable', 'actions.not-found'],
  },
  deleteAction: {
    kind: 'mutation',
    input: deleteActionInputSchema,
    output: deleteActionOutputSchema,
    errors: ['actions.unavailable', 'actions.not-found'],
  },
  prepareActionRun: {
    kind: 'mutation',
    input: prepareActionRunInputSchema,
    output: prepareActionRunOutputSchema,
    errors: [
      'actions.unavailable',
      'actions.not-found',
      'actions.untrusted',
      'actions.target-invalid',
    ],
  },
} as const

export type ActionsProcedureName = keyof typeof actionsProcedureDefinitions

export const actionsProcedures = actionsProcedureDefinitions satisfies Record<
  ActionsProcedureName,
  ProcedureContract
>
