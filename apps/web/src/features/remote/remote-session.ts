import {
  orderRemoteEndpoints,
  parsePublicError,
  type RemoteEndpointGroup,
  type RemotePublicErrorParse,
  type RemoteSessionHealth,
} from '@porcelain/client-runtime/remote'
import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { setBrowserDaemonToken } from '@renderer/lib/daemon'
import { isBrowser } from '@renderer/lib/platform'
import type { SessionConnectionStatus } from '@renderer/lib/session-browser-adapter'
import { trpcClient } from '@renderer/lib/trpc'
import { settleBackground } from '@shared/background'
import { useCallback, useEffect, useState } from 'react'

const ADAPTER_HEALTH = {
  idle: 'idle',
  connecting: 'connecting',
  open: 'healthy',
  reconnecting: 'recovering',
  'update-required': 'update-required',
} as const satisfies Record<SessionConnectionStatus, RemoteSessionHealth>

export function orderWebRemoteEndpoints(group: RemoteEndpointGroup): string[] {
  return orderRemoteEndpoints(group)
}

export function classifyRemoteFailure(value: unknown): RemotePublicErrorParse {
  return parsePublicError(value)
}

export function mapAdapterStatus(status: SessionConnectionStatus): RemoteSessionHealth {
  return ADAPTER_HEALTH[status]
}

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

async function probe(): Promise<boolean> {
  try {
    await trpcClient.recentRepos.query()
    return true
  } catch {
    return false
  }
}

function pairingToken(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  if (!('token' in body) || typeof body.token !== 'string') return null
  return body.token
}

/**
 * Development daemons serve a client token from `/dev-auth` so a browser context does not
 * have to be paired by hand. Production daemons never mount the route, so this 404s and
 * the gate stays locked exactly as before — the caller only reaches here after a failed
 * probe, which also makes it the self-heal for a stale credential in localStorage.
 */
async function devAutoAuthToken(): Promise<string | null> {
  try {
    const response = await fetch('/dev-auth', {
      headers: { [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION) },
    })
    if (!response.ok) return null
    return pairingToken(await response.json())
  } catch {
    return null
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
    const run = async (): Promise<void> => {
      const pairingCredential = new URLSearchParams(window.location.hash.slice(1)).get('token')
      if (window.location.pathname === '/pair' && pairingCredential !== null) {
        setStatus('pairing')
        try {
          const response = await fetch('/pair', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION),
            },
            body: JSON.stringify({ credential: pairingCredential }),
          })
          let body: unknown
          try {
            body = await response.json()
          } catch {
            body = undefined
          }
          const classified = classifyRemoteFailure(body)
          const token = pairingToken(body)
          if (token !== null && classified.kind === 'unreachable') {
            setBrowserDaemonToken(token)
            window.history.replaceState(null, '', '/')
            if (active) setStatus('open')
            return
          }
          window.history.replaceState(null, '', '/')
          if (active) {
            setError(true)
            setStatus('locked')
          }
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
      if (await probe()) {
        if (active) setStatus('open')
        return
      }
      // Hold 'checking' across the dev attempt: flashing the pairing form before we know
      // whether this daemon auto-authorizes is the exact interruption it exists to remove.
      const devToken = await devAutoAuthToken()
      if (!active) return
      if (devToken === null) {
        setStatus('locked')
        return
      }
      setBrowserDaemonToken(devToken)
      setStatus((await probe()) ? 'open' : 'locked')
    }
    settleBackground(run(), 'lifecycle')
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
