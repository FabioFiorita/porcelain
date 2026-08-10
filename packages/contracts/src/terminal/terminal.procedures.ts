import type { ProcedureContract } from '../procedure-contract'
import {
  renameTerminalInputSchema,
  renameTerminalOutputSchema,
  terminalSessionsInputSchema,
  terminalSessionsOutputSchema,
} from './terminal.contract'

const terminalProcedureDefinitions = {
  terminalSessions: {
    kind: 'query',
    input: terminalSessionsInputSchema,
    output: terminalSessionsOutputSchema,
    errors: [],
  },
  renameTerminal: {
    kind: 'mutation',
    input: renameTerminalInputSchema,
    output: renameTerminalOutputSchema,
    errors: [],
  },
} as const

export type TerminalProcedureName = keyof typeof terminalProcedureDefinitions

export const terminalProcedures = terminalProcedureDefinitions satisfies Record<
  TerminalProcedureName,
  ProcedureContract
>
