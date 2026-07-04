import { setBrowserDaemonToken } from '@renderer/lib/daemon'
import { isBrowser } from '@renderer/lib/platform'
import { trpcClient } from '@renderer/lib/trpc'
import { useCallback, useEffect, useState } from 'react'

type GateStatus = 'checking' | 'locked' | 'open'

interface TokenGate {
  status: GateStatus
  /** True while a submitted token is being verified (the form's Connect button spins). */
  connecting: boolean
  /** Set after a failed probe/submit so the form can show a muted error line. */
  error: boolean
  /** Persist + adopt a token and re-probe; on success the gate opens. */
  connect: (token: string) => void
}

// A cheap authenticated probe: recentRepos is a plain daemon query that 401s
// without a valid token (the same gate every request carries). Success means the
// token in lib/daemon is good and the WS will connect too; failure means locked.
// Uses the vanilla trpcClient — the sanctioned non-React client (this is a hook,
// so the lib/trpc import is inside the fence).
async function probe(): Promise<boolean> {
  try {
    await trpcClient.recentRepos.query()
    return true
  } catch {
    return false
  }
}

/**
 * Guards the browser client behind the daemon token: on mount it probes with the
 * persisted token (localStorage) and, until that succeeds, the caller renders a
 * lock screen instead of the app. In the packaged Electron app there's no gate —
 * the token rides the preload bridge, so `status` starts 'open' and stays there.
 */
export function useTokenGate(): TokenGate {
  const [status, setStatus] = useState<GateStatus>(isBrowser ? 'checking' : 'open')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!isBrowser) return
    let active = true
    probe().then((ok) => {
      if (!active) return
      setStatus(ok ? 'open' : 'locked')
    })
    return () => {
      active = false
    }
  }, [])

  const connect = useCallback((token: string) => {
    setConnecting(true)
    setError(false)
    // Adopt the token first so the probe request carries it, then verify.
    setBrowserDaemonToken(token)
    probe().then((ok) => {
      setConnecting(false)
      if (ok) setStatus('open')
      else setError(true)
    })
  }, [])

  return { status, connecting, error, connect }
}
