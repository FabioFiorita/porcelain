import {
  type ActionsInput,
  type ActionsOutput,
  actionsOutputSchema,
  type TrustActionsInput,
  type TrustActionsOutput,
  trustActionsOutputSchema,
} from '@porcelain/contracts/actions'
import {
  type RenameTerminalInput,
  type RenameTerminalOutput,
  renameTerminalOutputSchema,
  type TerminalSessionsInput,
  type TerminalSessionsOutput,
  terminalSessionsOutputSchema,
} from '@porcelain/contracts/terminal'

import { defineMutation, defineQuery } from '../procedure'

export type TerminalInfo = TerminalSessionsOutput[number]
export type TerminalAction = ActionsOutput[number]

export const terminalSessionsQuery = defineQuery<TerminalSessionsInput, TerminalSessionsOutput>(
  'terminalSessions',
  terminalSessionsOutputSchema,
)

export const renameTerminalMutation = defineMutation<RenameTerminalInput, RenameTerminalOutput>(
  'renameTerminal',
  renameTerminalOutputSchema,
)

export const actionsQuery = defineQuery<ActionsInput, ActionsOutput>('actions', actionsOutputSchema)

export const trustActionsMutation = defineMutation<TrustActionsInput, TrustActionsOutput>(
  'trustActions',
  trustActionsOutputSchema,
)
