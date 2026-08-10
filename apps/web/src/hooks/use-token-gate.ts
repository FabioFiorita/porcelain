import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { setBrowserDaemonToken } from '@renderer/lib/daemon'
import { isBrowser } from '@renderer/lib/platform'
import { trpcClient } from '@renderer/lib/trpc'
import { useCallback, useEffect, useState } from 'react'

type GateStatus = 'checking' | 'pairing' | 'locked' | 'open'

interface TokenGate {
  status: GateStatus
  /** True while a submitted token is being verified (the form's Connect button spins). */
  connecting: boolean
  /** Set after a failed probe/submit so the form can show a muted error line. */
  error: boolean
  /** Navigate to a complete pairing link pasted by the human. */
  connect: (link: string) => void
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
 * Guards the browser client behind its device credential: on mount it probes with the
 * persisted credential (localStorage), and until that succeeds the caller renders a
 * lock screen instead of the app. Electron has no gate — the token rides the preload
 * bridge, so `status` starts 'open' and stays there. A `/pair#token=…` link exchanges
 * its one-time fragment credential for this browser's revocable client token.
 */
export function useTokenGate(): TokenGate {
  const [status, setStatus] = useState<GateStatus>(isBrowser ? 'checking' : 'open')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!isBrowser) return
    let active = true
    void (async () => {
      const pairingCredential = new URLSearchParams(window.location.hash.slice(1)).get('token')
      if (window.location.pathname === '/pair' && pairingCredential !== null) {
        setStatus('pairing')
        try {
          const response = await fetch('/pair', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              // Pairing is unauthenticated but not unversioned: it crosses the same
              // daemon boundary as every tRPC request and declares the same protocol.
              [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION),
            },
            body: JSON.stringify({ credential: pairingCredential }),
          })
          if (!response.ok) throw new Error(`pairing failed (${response.status})`)
          const body: unknown = await response.json()
          if (
            typeof body !== 'object' ||
            body === null ||
            !('token' in body) ||
            typeof body.token !== 'string'
          ) {
            throw new Error('invalid pairing response')
          }
          setBrowserDaemonToken(body.token)
          window.history.replaceState(null, '', '/')
          if (active) setStatus('open')
          return
        } catch {
          window.history.replaceState(null, '', '/')
          if (active) {
            setError(true)
            setStatus('locked')
          }
          return
        }
      }
      const ok = await probe()
      if (!active) return
      setStatus(ok ? 'open' : 'locked')
    })()
    return () => {
      active = false
    }
  }, [])

  const connect = useCallback((link: string) => {
    setConnecting(true)
    setError(false)
    try {
      const url = new URL(link)
      const credential = new URLSearchParams(url.hash.slice(1)).get('token')
      if (
        (url.protocol !== 'http:' && url.protocol !== 'https:') ||
        url.pathname !== '/pair' ||
        credential === null ||
        credential === ''
      ) {
        throw new Error('invalid link')
      }
      window.location.assign(url)
    } catch {
      setConnecting(false)
      setError(true)
    }
  }, [])

  return { status, connecting, error, connect }
}
