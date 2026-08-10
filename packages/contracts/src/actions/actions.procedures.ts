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
    errors: [],
  },
  trustActions: {
    kind: 'mutation',
    input: trustActionsInputSchema,
    output: trustActionsOutputSchema,
    errors: [],
  },
  addAction: {
    kind: 'mutation',
    input: addActionInputSchema,
    output: addActionOutputSchema,
    errors: [],
  },
  updateAction: {
    kind: 'mutation',
    input: updateActionInputSchema,
    output: updateActionOutputSchema,
    errors: [],
  },
  moveAction: {
    kind: 'mutation',
    input: moveActionInputSchema,
    output: moveActionOutputSchema,
    errors: [],
  },
  deleteAction: {
    kind: 'mutation',
    input: deleteActionInputSchema,
    output: deleteActionOutputSchema,
    errors: [],
  },
} as const

export type ActionsProcedureName = keyof typeof actionsProcedureDefinitions

export const actionsProcedures = actionsProcedureDefinitions satisfies Record<
  ActionsProcedureName,
  ProcedureContract
>
