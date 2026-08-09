import type { ProcedureContract } from '../procedure-contract'
import type { ProcedureName } from '../procedures/names'
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
  },
  trustActions: {
    kind: 'mutation',
    input: trustActionsInputSchema,
    output: trustActionsOutputSchema,
  },
  addAction: {
    kind: 'mutation',
    input: addActionInputSchema,
    output: addActionOutputSchema,
  },
  updateAction: {
    kind: 'mutation',
    input: updateActionInputSchema,
    output: updateActionOutputSchema,
  },
  moveAction: {
    kind: 'mutation',
    input: moveActionInputSchema,
    output: moveActionOutputSchema,
  },
  deleteAction: {
    kind: 'mutation',
    input: deleteActionInputSchema,
    output: deleteActionOutputSchema,
  },
} as const

export type ActionsProcedureName = Extract<keyof typeof actionsProcedureDefinitions, ProcedureName>

export const actionsProcedures = actionsProcedureDefinitions satisfies Record<
  ActionsProcedureName,
  ProcedureContract
>
