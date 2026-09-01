/**
 * Shared Terminal client semantics (stream + roster).
 *
 * Stream state/recovery plus daemon-global sessions identity and rename
 * consequence. Adapters bind transport and React.
 */

export type { DevServerMutationDefinition } from './dev-server-mutations'
export { devServerMutations, devServersNotificationEffects } from './dev-server-mutations'
export type { DevServersQuery } from './dev-server-queries'
export { devServersQuery, devServersQuerySchema } from './dev-server-queries'
export type { TerminalGroup, TerminalLocation } from './terminal-groups'
export {
  ELSEWHERE_GROUP_KEY,
  ENVIRONMENT_GROUP_KEY,
  groupTerminalSessions,
  locationForCwd,
  terminalLocationGroups,
  terminalLocationLabel,
  terminalLocations,
} from './terminal-groups'
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
