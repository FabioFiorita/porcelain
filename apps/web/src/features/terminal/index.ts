/** Web Terminal public boundary: transport adapter, roster binding, and recovery copy. */

export { useDevServersNotificationSubscription } from './dev-servers'
export { DevServersSection } from './dev-servers-section'
export { applyTerminalRecovery, terminalPasteFailureMessage } from './terminal-notifications'
export {
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
