/** Web Terminal public boundary: transport adapter, roster binding, and recovery copy. */

export { applyTerminalRecovery, terminalPasteFailureMessage } from './terminal-notifications'
export { useTerminalRoster } from './terminal-roster'
export {
  type BrowserTerminalAdapter,
  type BrowserTerminalAdapterOptions,
  createBrowserTerminalAdapter,
  type TerminalAdapterFailure,
  type TerminalAttachResult,
  type TerminalPasteResult,
  type TerminalStreamListeners,
  terminalAdapterFor,
  terminalAdapterForSession,
  useTerminalStream,
} from './terminal-stream-adapter'
