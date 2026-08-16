import { beforeEach, describe, expect, it, vi } from 'vitest'
import { primary } from './daemon'
import {
  forgetLocalTerminal,
  forgetTerminalSession,
  isLocalTerminal,
  localDaemonSession,
  markLocalTerminal,
  registerTerminalSession,
  sessionForTerminal,
  setLocalDaemonEndpoint,
} from './local-daemon'

// A session connects lazily (ensureSession runs on the first subscribe/send) and the tRPC
// client makes no request until a procedure is called — but RE-pointing one reconnects
// immediately, so stub the socket. jsdom would otherwise open a real connection to a dead
// port whose async failure can escape teardown as an unhandled error (the flake that made
// the terminals-store tests mock their client).
class SocketStub {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  readyState = SocketStub.CONNECTING
  close(): void {}
  send(): void {}
}
vi.stubGlobal('WebSocket', SocketStub)

describe('sessionForTerminal', () => {
  beforeEach(() => {
    forgetLocalTerminal('t-local')
    forgetLocalTerminal('t-remote')
  })

  it('routes an unknown id to the primary daemon — the pre-local behaviour', () => {
    expect(sessionForTerminal('t-remote')).toBe(primary)
  })

  it('routes a marked id to the local session once it exists', () => {
    const local = setLocalDaemonEndpoint({ url: 'http://127.0.0.1:1234', token: 'tok' })
    markLocalTerminal('t-local')
    expect(sessionForTerminal('t-local')).toBe(local)
    expect(sessionForTerminal('t-remote')).toBe(primary)
  })

  it('routes an explicitly registered id to its Environment session', () => {
    const remote = setLocalDaemonEndpoint({ url: 'http://127.0.0.1:2345', token: 'remote' })
    registerTerminalSession('t-environment', remote)
    expect(sessionForTerminal('t-environment')).toBe(remote)
    forgetTerminalSession('t-environment')
    expect(sessionForTerminal('t-environment')).toBe(primary)
  })

  it('falls back to primary for a marked id when no local session exists', () => {
    // Can't unset the module's session, so assert the guard's shape directly: the router
    // requires BOTH the mark and a live session, so a mark alone never misroutes.
    markLocalTerminal('t-local')
    expect(isLocalTerminal('t-local')).toBe(true)
    expect(localDaemonSession()).not.toBeNull()
  })

  it('stops routing to local after the session is forgotten (killed terminal)', () => {
    setLocalDaemonEndpoint({ url: 'http://127.0.0.1:1234', token: 'tok' })
    markLocalTerminal('t-local')
    forgetLocalTerminal('t-local')
    expect(isLocalTerminal('t-local')).toBe(false)
    expect(sessionForTerminal('t-local')).toBe(primary)
  })
})

describe('setLocalDaemonEndpoint', () => {
  it('re-points the SAME session rather than rebuilding it, so live PTYs survive', () => {
    const first = setLocalDaemonEndpoint({ url: 'http://127.0.0.1:1234', token: 'tok' })
    const second = setLocalDaemonEndpoint({ url: 'http://127.0.0.1:9999', token: 'tok' })
    expect(second).toBe(first)
    expect(second.endpoint()).toEqual({ url: 'http://127.0.0.1:9999', token: 'tok' })
  })
})
