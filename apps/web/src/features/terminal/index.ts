/** Web Terminal public boundary: transport adapter, roster binding, and recovery copy. */

export { findHubProjectForPath, suggestLocalTerminalPath } from './local-path-suggestion'
export { useEnvironmentTerminalStreams } from './environment-terminals'
export {
  applyTerminalRecovery,
  terminalFailureMessage,
  terminalPasteFailureMessage,
  TerminalRequestError,
} from './terminal-notifications'
export { terminalSessionsQueryKey } from './terminal-query-key'
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
