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

export const terminalSessionsQuery = defineQuery<TerminalSessionsInput, TerminalSessionsOutput>(
  'terminalSessions',
  terminalSessionsOutputSchema,
)

export const renameTerminalMutation = defineMutation<RenameTerminalInput, RenameTerminalOutput>(
  'renameTerminal',
  renameTerminalOutputSchema,
)
