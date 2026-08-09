import type { ProcedureContract } from '../procedure-contract'
import type { ProcedureName } from '../procedures/names'
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

export type TerminalProcedureName = Extract<
  keyof typeof terminalProcedureDefinitions,
  ProcedureName
>

export const terminalProcedures = terminalProcedureDefinitions satisfies Record<
  TerminalProcedureName,
  ProcedureContract
>
