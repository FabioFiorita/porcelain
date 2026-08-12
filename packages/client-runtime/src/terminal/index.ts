/**
 * Shared Terminal client semantics (stream + roster).
 *
 * Stream state/recovery (TRM-003) plus daemon-global sessions identity and rename
 * consequence (TRM-006). Adapters bind transport and React.
 */

export type { TerminalMutation, TerminalMutationDefinition } from './terminal-mutations'
export { terminalMutations } from './terminal-mutations'
export type { TerminalIdentity, TerminalSessionsQuery } from './terminal-queries'
export {
  terminalIdentitySchema,
  terminalSessionsQuery,
  terminalSessionsQuerySchema,
} from './terminal-queries'
export type {
  TerminalAttachmentState,
  TerminalAttachmentStatus,
  TerminalData,
  TerminalExit,
  TerminalRecovery,
  TerminalRecoveryReason,
  TerminalStreamEffect,
  TerminalStreamState,
} from './terminal-recovery'
export type {
  TerminalRequest,
  TerminalRequestFailure,
  TerminalRequestKind,
  TerminalRequestSuccessFrame,
} from './terminal-requests'
export { createTerminalStreamState } from './terminal-stream'
