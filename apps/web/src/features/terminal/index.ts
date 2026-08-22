/** Web Terminal public boundary: transport adapter, roster binding, and recovery copy. */

export { findHubProjectForPath, suggestLocalTerminalPath } from './local-path-suggestion'
// The board's grouping rule is shared with the mobile Terminals tab, so it lives in
// client-runtime and both clients read one implementation. Re-exported here so web's own
// boundary stays the single import site for everything Terminal.
export {
  ELSEWHERE_GROUP_KEY,
  ENVIRONMENT_GROUP_KEY,
  groupTerminalSessions,
  type TerminalGroup,
  type TerminalLocation,
  terminalLocations,
} from '@porcelain/client-runtime/terminal'
export {
  type EnvironmentTerminals,
  useEnvironmentTerminals,
  useEnvironmentTerminalStreams,
} from './environment-terminals'
export { applyTerminalRecovery, terminalPasteFailureMessage } from './terminal-notifications'
export {
  invalidateEveryTerminalSessionsQuery,
  invalidateTerminalSessionsQueries,
  terminalSessionsQueryKey,
} from './terminal-query-key'
export { useTerminalRoster } from './terminal-roster'
export {
  type BrowserTerminalAdapter,
  type BrowserTerminalAdapterOptions,
  createBrowserTerminalAdapter,
  type TerminalAdapterFailure,
  type TerminalAttachResult,
  type TerminalStreamListeners,
  terminalAdapterFor,
  terminalAdapterForSession,
  useTerminalStream,
} from './terminal-stream-adapter'
export { listTerminalSessionsOnDaemon, renameTerminalOnDaemon } from './terminal-transport'
export { openTerminalsBoard } from './terminals-navigation'
