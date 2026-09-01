/** Mobile Terminal public boundary: stream transport, recovery, roster, and presentation roots. */

import { useTerminalStore } from './terminal-store'

export {
  applyTerminalRecovery,
  terminalPasteFailureMessage,
  useMobileTerminalRecovery,
} from './terminal-recovery'
export {
  useRefreshTerminals,
  useRenameTerminal,
  useTerminalStream,
  useTerminals,
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
export { TerminalsScreen } from './terminals-screen'

/** Public create surface for Actions prepare → Terminal create. */
export async function spawnTerminalSession(opts: {
  cwd: string
  name?: string
  initialInput?: string
}): Promise<string> {
  return useTerminalStore.getState().spawn(opts)
}
