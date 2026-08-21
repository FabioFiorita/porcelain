import {
  ensureEnvironmentSession,
  setShellEnvironmentConnections,
} from '@renderer/lib/environment-sessions'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'
import { useEffect } from 'react'

/**
 * Pre-warm every saved Environment's daemon session at boot, Electron-only — the browser
 * client sources its secondary sessions from localStorage instead (see environment-sessions.ts).
 * Without this, a session is created lazily on first routing lookup and never `.start()`s
 * itself, so the WS never opens until something else happens to touch it.
 */
export function useShellEnvironmentConnections(): void {
  const { data } = shellTrpc.environmentDaemonPairs.useQuery(undefined, { enabled: !isBrowser })

  useEffect(() => {
    if (isBrowser || data === undefined) return
    setShellEnvironmentConnections(data)
  }, [data])

  useEffect(() => {
    if (isBrowser || data === undefined) return
    for (const connection of data) ensureEnvironmentSession(connection).session.start()
  }, [data])
}
