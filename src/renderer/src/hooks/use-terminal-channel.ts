import { onTerminalData, onTerminalExit } from '@renderer/lib/daemon'
import { receiveData, receiveExit } from '@renderer/lib/terminal-registry'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { useEffect } from 'react'

/**
 * Consumes the inbound half of the terminal stream on the daemon WS session
 * (lib/daemon.ts), mounted once in AppShell — the inbound twin of `useAppEvents`.
 * PTY output is routed to the matching xterm (via the registry, which buffers
 * until the view mounts) and an exit both writes the footer and marks the roster
 * session "exited". Keystrokes/resizes flow back out per-instance from the
 * registry, so only the inbound half lives here.
 */
export function useTerminalChannel(): void {
  const markExited = useTerminalsStore((s) => s.markExited)

  useEffect(() => {
    const offData = onTerminalData(receiveData)
    const offExit = onTerminalExit((id, exitCode) => {
      receiveExit(id, exitCode)
      markExited(id, exitCode)
    })
    return () => {
      offData()
      offExit()
    }
  }, [markExited])
}
