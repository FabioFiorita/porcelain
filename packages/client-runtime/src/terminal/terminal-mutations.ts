import { type RenameTerminalInput, terminalProcedures } from '@porcelain/contracts/terminal'
import { type TerminalSessionsQuery, terminalSessionsQuery } from './terminal-queries'

/**
 * Terminal mutation consequence definitions.
 *
 * Single non-optimistic rename: the roster identity is daemon-global, so every
 * rename refetches the same sessions slot. Transport and React stay in adapters.
 */

export type TerminalMutationDefinition = {
  readonly procedure: typeof terminalProcedures.renameTerminal
  readonly procedureName: 'renameTerminal'
  readonly affectedQueries: (input: RenameTerminalInput) => readonly [TerminalSessionsQuery]
  readonly requiresAuthoritativeRefetch: true
}

export const terminalMutations = {
  rename: {
    procedure: terminalProcedures.renameTerminal,
    procedureName: 'renameTerminal',
    affectedQueries: (_input: RenameTerminalInput) => [terminalSessionsQuery()] as const,
    requiresAuthoritativeRefetch: true,
  },
} as const satisfies {
  readonly rename: TerminalMutationDefinition
}

export type TerminalMutation = (typeof terminalMutations)[keyof typeof terminalMutations]
