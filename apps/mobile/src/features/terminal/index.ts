/** Mobile Terminal public boundary: stream transport, recovery, roster, and presentation roots. */

export { TerminalCompanion } from './terminal-companion'
export { TerminalList } from './terminal-list'
export { TerminalPhoneScreen } from './terminal-phone-screen'
export {
  applyTerminalRecovery,
  terminalPasteFailureMessage,
  useMobileTerminalRecovery,
} from './terminal-recovery'
export {
  useRenameTerminal,
  useTerminalActions,
  useTerminalStream,
  useTerminals,
  useTrustAction,
} from './terminal-roster'
export { TerminalSessionScreen } from './terminal-session-screen'
export {
  createMobileTerminalAdapter,
  type MobileTerminalAdapter,
  type MobileTerminalAdapterOptions,
  mobileTerminalAdapter,
  type TerminalAdapterFailure,
  type TerminalAttachResult,
  type TerminalPasteResult,
  type TerminalStreamListeners,
  useMobileTerminalStream,
} from './terminal-stream-adapter'
export { TerminalViewer } from './terminal-viewer'
