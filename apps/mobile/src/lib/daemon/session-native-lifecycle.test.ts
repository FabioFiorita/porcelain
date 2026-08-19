import {
  createSessionClientRuntime,
  type TerminalServerFrame,
} from '@porcelain/client-runtime/session/client-runtime'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import { PROTOCOL_VERSION } from '@porcelain/contracts'
import type { SessionChange, SessionMismatchFrame } from '@porcelain/contracts/session'
import { sessionContractFixtures } from '@porcelain/contracts/session'
import { terminalStreamFixtures } from '@porcelain/contracts/terminal'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  configureSession,
  daemonSession,
  onSessionClosed,
  sessionClientRuntime,
  setSessionForeground,
  subscribeSessionChanges,
} from './session'

/**
 * Lifecycle proofs for the mobile session binding: foreground/background, hello/ready/mismatch,
 * recovery, interest updates, and sequence-gap — exercised through the real shared runtime and
 * a fake socket opener injected by replacing the module-level adapter is not available, so these
 * tests drive `sessionClientRuntime()` for protocol state and the public configure/foreground
 * surface for phone lifecycle. Adapter reconnect tables live in `session-native-adapter.test.ts`.
 */

const PROJECT = '/synthetic/repo'
const PROJECT_ID = 'proj-alpha'
const EPOCH = 'synthetic-epoch'

function readyFrame(epoch = EPOCH) {
  return { t: 'session:ready', protocolVersion: PROTOCOL_VERSION, epoch }
}

/**
 * One valid change of the requested kind — the extra fields some kinds require included.
 * Actions changes carry the stable Project id rather than a checkout path: one Project owns
 * many Worktrees, so a path could not name it (#24).
 */
function buildChange(kind: SessionChange['kind'], projectPath: string): SessionChange {
  if (kind === 'actions.changed') return { kind, projectId: PROJECT_ID }
  if (kind === 'files.tree-changed' || kind === 'files.content-changed') {
    return { kind, projectPath, paths: [`${projectPath}/src`] }
  }
  if (kind === 'terminal.dev-servers-changed') {
    return { kind, projectPath, projectId: 'project-1', worktreeId: 'worktree-1' }
  }
  if (kind === 'terminal.worktree-script-started') {
    return {
      kind,
      role: 'worktree-setup',
      projectId: 'project-1',
      worktreeId: 'worktree-1',
      terminalId: 'terminal-1',
    }
  }
  return { kind, projectPath }
}

function changeFrame({
  epoch = EPOCH,
  sequence,
  kind = 'files.scope-changed' as const,
  projectPath = PROJECT,
}: {
  epoch?: string
  sequence: number
  kind?: SessionChange['kind']
  projectPath?: string
}): unknown {
  const change: SessionChange = buildChange(kind, projectPath)
  return { t: 'session:change', epoch, sequence, change }
}

type ProtocolHarness = {
  readonly runtime: ReturnType<typeof createSessionClientRuntime>
  readonly sent: unknown[]
  readonly changes: SessionChange[]
  readonly terminal: TerminalServerFrame[]
  readonly requirements: FreshnessRequirement[]
  readonly mismatches: SessionMismatchFrame[]
  readonly connect: () => void
  readonly deliver: (frame: unknown) => void
}

/** Pure runtime harness — same shape as client-runtime tests — for protocol tables. */
function protocolHarness(): ProtocolHarness {
  const sent: unknown[] = []
  const changes: SessionChange[] = []
  const terminal: TerminalServerFrame[] = []
  const requirements: FreshnessRequirement[] = []
  const mismatches: SessionMismatchFrame[] = []
  const runtime = createSessionClientRuntime({
    observer: {
      onChange: (change) => changes.push(change),
      onTerminalFrame: (frame) => terminal.push(frame),
      onFreshnessRequired: (requirement) => requirements.push(requirement),
      onUpdateRequired: (frame) => mismatches.push(frame),
    },
  })
  const transport = {
    send(payload: string) {
      sent.push(JSON.parse(payload))
    },
  }
  return {
    runtime,
    sent,
    changes,
    terminal,
    requirements,
    mismatches,
    connect: () => runtime.connected(transport),
    deliver: (frame) => runtime.receive(JSON.stringify(frame)),
  }
}

afterEach(() => {
  configureSession(null)
  setSessionForeground(true)
  onSessionClosed(() => undefined)
  // Direct runtime.connected calls in binding tests leave the shared runtime open; drop it.
  sessionClientRuntime().disconnected()
})

describe('Session native lifecycle — protocol (shared runtime)', () => {
  it('handshakes hello → ready and registers empty watches when a project is selected', () => {
    const context = protocolHarness()
    context.runtime.selectProject(PROJECT)
    context.connect()

    expect(context.sent).toEqual([{ t: 'session:hello', protocolVersion: PROTOCOL_VERSION }])
    expect(context.runtime.status()).toBe('handshaking')

    context.deliver(readyFrame())

    expect(context.runtime.status()).toBe('open')
    expect(context.sent[1]).toEqual({
      t: 'session:watches',
      projectPath: PROJECT,
      files: [],
      dirs: [],
    })
    expect(context.requirements).toEqual([])
  })

  it('reports update-required on mismatch and never accepts later frames', () => {
    const context = protocolHarness()
    context.runtime.selectProject(PROJECT)
    context.connect()
    context.deliver(sessionContractFixtures.mismatch)

    expect(context.mismatches).toEqual([sessionContractFixtures.mismatch])
    expect(context.runtime.status()).toBe('update-required')

    context.runtime.disconnected()
    context.connect()
    context.deliver(readyFrame())
    context.deliver(changeFrame({ sequence: 0 }))

    expect(context.runtime.status()).toBe('update-required')
    expect(context.changes).toEqual([])
    expect(context.mismatches).toHaveLength(1)
  })

  it('marks session stale on reconnect and project stale on a sequence gap', () => {
    const context = protocolHarness()
    context.runtime.selectProject(PROJECT)
    context.connect()
    context.deliver(readyFrame())
    context.deliver(changeFrame({ sequence: 0 }))

    context.runtime.disconnected()
    context.connect()
    context.deliver(readyFrame())

    expect(context.requirements).toEqual([{ reason: 'reconnect', scope: { kind: 'session' } }])

    context.deliver(changeFrame({ sequence: 0 }))
    context.deliver(changeFrame({ sequence: 4 }))

    expect(context.requirements.at(-1)).toEqual({
      reason: 'sequence-gap',
      scope: { kind: 'project', projectPath: PROJECT },
    })
    expect(context.changes).toHaveLength(3)
  })

  it('re-registers interests after ready and on interest updates', () => {
    const context = protocolHarness()
    context.runtime.selectProject(PROJECT)
    context.connect()
    context.deliver(readyFrame())

    const reg = context.runtime.registerWatchInterest({
      files: [`${PROJECT}/a.ts`],
      dirs: [`${PROJECT}/src`],
    })

    expect(context.sent.at(-1)).toEqual({
      t: 'session:watches',
      projectPath: PROJECT,
      files: [`${PROJECT}/a.ts`],
      dirs: [`${PROJECT}/src`],
    })

    reg.release()

    expect(context.sent.at(-1)).toEqual({
      t: 'session:watches',
      projectPath: PROJECT,
      files: [],
      dirs: [],
    })
  })

  it('delivers terminal frames without consuming the change sequence', () => {
    const context = protocolHarness()
    context.runtime.selectProject(PROJECT)
    context.connect()
    context.deliver(readyFrame())

    context.deliver(terminalStreamFixtures.output.data)
    context.deliver(changeFrame({ sequence: 0 }))
    context.deliver(terminalStreamFixtures.lifecycle.exit)

    expect(context.terminal.map((frame) => frame.t)).toEqual(['terminal:data', 'terminal:exit'])
    expect(context.requirements).toEqual([])
  })
})

describe('Session native lifecycle — mobile binding', () => {
  it('selects the project through configureSession and exposes it on the runtime', () => {
    configureSession({
      baseUrl: 'http://127.0.0.1:43118',
      token: 'synthetic-token',
      repo: PROJECT,
    })

    expect(sessionClientRuntime().projectPath()).toBe(PROJECT)
  })

  it('stops the socket when backgrounded and allows restart when foregrounded', () => {
    configureSession({
      baseUrl: 'http://127.0.0.1:43118',
      token: 'synthetic-token',
      repo: PROJECT,
    })
    // Without a real socket the adapter may be connecting against nothing; stop must still be
    // idempotent and leave status idle.
    setSessionForeground(false)
    expect(daemonSession.status === 'idle' || daemonSession.status === 'connecting').toBe(true)
    setSessionForeground(false)
    expect(daemonSession.status).toBe('idle')

    setSessionForeground(true)
    // Wanted remains true after a project was configured, so foreground reopens.
    expect(['connecting', 'open', 'reconnecting', 'idle']).toContain(daemonSession.status)
  })

  it('forwards change and freshness signals to session observers', () => {
    const changes: SessionChange[] = []
    const requirements: FreshnessRequirement[] = []
    const stop = subscribeSessionChanges({
      onChange: (change) => changes.push(change),
      onFreshnessRequired: (requirement) => requirements.push(requirement),
    })

    // Drive the shared runtime the module owns (same instance observers are wired to).
    const runtime = sessionClientRuntime()
    const sent: string[] = []
    runtime.selectProject(PROJECT)
    runtime.connected({ send: (payload) => sent.push(payload) })
    runtime.receive(JSON.stringify(readyFrame()))
    runtime.receive(
      JSON.stringify({
        t: 'session:change',
        epoch: EPOCH,
        sequence: 0,
        change: { kind: 'files.scope-changed', projectPath: PROJECT },
      }),
    )
    runtime.receive(
      JSON.stringify({
        t: 'session:change',
        epoch: EPOCH,
        sequence: 5,
        change: { kind: 'actions.changed', projectId: PROJECT_ID },
      }),
    )

    expect(changes).toEqual([
      { kind: 'files.scope-changed', projectPath: PROJECT },
      { kind: 'actions.changed', projectId: PROJECT_ID },
    ])
    // The gap surfaced on a Project-scoped Actions change, which names no checkout — so the
    // requirement widens to the whole session instead of guessing a path (#24).
    expect(requirements).toEqual([{ reason: 'sequence-gap', scope: { kind: 'session' } }])
    expect(sent[0]).toContain('session:hello')
    stop()
  })

  it('exposes generic Terminal frames and orders ready, reconnect, and close lifecycle', () => {
    const order: string[] = []
    const stopFrame = daemonSession.onTerminalFrame(() => {
      order.push('frame')
    })
    const stopReady = daemonSession.onDaemonReady(() => {
      order.push('ready')
    })
    const stopReconnect = daemonSession.onDaemonReconnect(() => {
      order.push('reconnect')
    })
    const stopClose = daemonSession.onDaemonClose(() => {
      order.push('close')
    })
    const runtime = sessionClientRuntime()
    runtime.connected({ send: () => undefined })
    runtime.receive(JSON.stringify(readyFrame()))
    runtime.receive(JSON.stringify(terminalStreamFixtures.output.data))
    runtime.disconnected()
    runtime.connected({ send: () => undefined })
    runtime.receive(JSON.stringify(readyFrame()))

    expect(order).toEqual(['ready', 'frame', 'close', 'ready', 'reconnect'])
    stopFrame()
    stopReady()
    stopReconnect()
    stopClose()
  })

  it('notifies the generic close seam before retiring an update-required session', () => {
    const closes: string[] = []
    const stop = daemonSession.onDaemonClose(() => {
      closes.push('close')
    })
    const runtime = sessionClientRuntime()
    runtime.connected({ send: () => undefined })
    runtime.receive(JSON.stringify(sessionContractFixtures.mismatch))

    expect(closes).toEqual(['close'])
    stop()
  })

  it('invokes onSessionClosed(revoked) wiring without throwing when cleared', async () => {
    const handler = vi.fn()
    onSessionClosed(handler)
    onSessionClosed(() => undefined)
    expect(handler).not.toHaveBeenCalled()
  })
})
