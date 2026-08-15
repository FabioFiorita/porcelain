import type { ProcedureContract } from '../procedure-contract'
import {
  devServerSchema,
  devServersInputSchema,
  devServersOutputSchema,
  dismissDevServerInputSchema,
  dismissDevServerOutputSchema,
  startDevServerInputSchema,
  stopDevServerInputSchema,
} from './dev-server.contract'
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
  devServers: {
    kind: 'query',
    input: devServersInputSchema,
    output: devServersOutputSchema,
    errors: [],
  },
  startDevServer: {
    kind: 'mutation',
    input: startDevServerInputSchema,
    output: devServerSchema,
    errors: ['terminal.dev-server-target', 'terminal.capacity'],
  },
  stopDevServer: {
    kind: 'mutation',
    input: stopDevServerInputSchema,
    output: devServerSchema,
    errors: ['terminal.dev-server-not-found'],
  },
  dismissDevServer: {
    kind: 'mutation',
    input: dismissDevServerInputSchema,
    output: dismissDevServerOutputSchema,
    errors: ['terminal.dev-server-not-found', 'terminal.dev-server-running'],
  },
} as const

export type TerminalProcedureName = keyof typeof terminalProcedureDefinitions

export const terminalProcedures = terminalProcedureDefinitions satisfies Record<
  TerminalProcedureName,
  ProcedureContract
>
