import { PROTOCOL_VERSION } from '@porcelain/contracts'
import {
  type SessionChangeFrame,
  sessionChangeFrameSchema,
  sessionContractFixtures,
  sessionMismatchFrameSchema,
  sessionReadyFrameSchema,
  sessionWatchesFixtures,
} from '@porcelain/contracts/session'
import { terminalStreamFixtures } from '@porcelain/contracts/terminal'
import { describe, expect, it, vi } from 'vitest'
import { createSessionChangePublisher } from './change-publisher'
import {
  createSessionGateway,
  SESSION_CLOSE_PROTOCOL_MISMATCH,
  SESSION_CLOSE_UNAUTHENTICATED,
  type SessionConnection,
  type TerminalClientFrame,
} from './session-gateway'

const EPOCH = 'synthetic-epoch'
const PROJECT = '/synthetic/repo'

function harness({ identity = { kind: 'admin' } as SessionConnection['identity'] } = {}) {
  const publisher = createSessionChangePublisher({ epoch: EPOCH })
  const gateway = createSessionGateway({
    publisher,
    protocolVersion: PROTOCOL_VERSION,
    epoch: EPOCH,
  })
  const sent: unknown[] = []
  const closed: Array<{ code: number; reason: string }> = []
  const watchSink = {
    apply:
      vi.fn<
        (interests: {
          readonly projectPath: string
          readonly files: readonly string[]
          readonly dirs: readonly string[]
        }) => void
      >(),
    clear: vi.fn<() => void>(),
  }
  const onProjectScopeChanged = vi.fn<(projectPath: string | undefined) => void>()
  const received: TerminalClientFrame[] = []
  const terminal = {
    receive: (frame: TerminalClientFrame) => received.push(frame),
    detach: vi.fn<() => void>(),
  }

  const outcome = gateway.openSession({
    identity,
    transport: {
      send: (payload) => sent.push(JSON.parse(payload)),
      close: (code, reason) => closed.push({ code, reason }),
    },
    watchSink,
    onProjectScopeChanged,
    terminal,
  })

  return {
    publisher,
    outcome,
    sent,
    closed,
    watchSink,
    onProjectScopeChanged,
    terminal,
    received,
  }
}

function openedSession() {
  const context = harness()
  if (!context.outcome.ok) throw new Error('expected an authenticated session')
  const session = context.outcome.session
  session.receive(JSON.stringify(sessionContractFixtures.hello))
  return { ...context, session }
}

function changeFrames(sent: readonly unknown[]): SessionChangeFrame[] {
  return sent
    .map((frame) => sessionChangeFrameSchema.safeParse(frame))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
}

describe('Session gateway', () => {
  it('refuses an unauthenticated connection before any session resource exists', () => {
    const { outcome, publisher, sent, closed, watchSink, terminal } = harness({ identity: null })

    expect(outcome).toEqual({ ok: false, error: { code: 'session.unauthenticated' } })
    expect(closed).toEqual([{ code: SESSION_CLOSE_UNAUTHENTICATED, reason: 'unauthenticated' }])
    expect(sent).toEqual([])
    expect(publisher.subscriptionCount()).toBe(0)
    expect(watchSink.apply).not.toHaveBeenCalled()
    expect(terminal.detach).not.toHaveBeenCalled()
  })

  it('answers a matching hello with ready and opens exactly one subscription', () => {
    const { sent, publisher, session } = openedSession()

    expect(sent).toHaveLength(1)
    expect(sessionReadyFrameSchema.parse(sent[0])).toEqual({
      t: 'session:ready',
      protocolVersion: PROTOCOL_VERSION,
      epoch: EPOCH,
    })
    expect(publisher.subscriptionCount()).toBe(1)
    expect(session.isOpen()).toBe(true)
  })

  it('closes a mismatched hello without registering anything', () => {
    const context = harness()
    if (!context.outcome.ok) throw new Error('expected an authenticated session')
    context.outcome.session.receive(
      JSON.stringify({ t: 'session:hello', protocolVersion: PROTOCOL_VERSION + 1 }),
    )

    expect(sessionMismatchFrameSchema.parse(context.sent[0])).toEqual({
      t: 'session:mismatch',
      code: 'protocol.update-required',
      expected: PROTOCOL_VERSION,
      received: PROTOCOL_VERSION + 1,
    })
    expect(context.closed).toEqual([
      { code: SESSION_CLOSE_PROTOCOL_MISMATCH, reason: 'protocol.update-required' },
    ])
    expect(context.publisher.subscriptionCount()).toBe(0)
    expect(context.watchSink.apply).not.toHaveBeenCalled()
    expect(context.outcome.session.isOpen()).toBe(false)
  })

  it('refuses a first frame that is not a hello, including watches', () => {
    for (const first of [
      JSON.stringify(sessionWatchesFixtures.watches),
      JSON.stringify(terminalStreamFixtures.input.write),
      'not json at all',
    ]) {
      const context = harness()
      if (!context.outcome.ok) throw new Error('expected an authenticated session')
      context.outcome.session.receive(first)

      expect(sessionMismatchFrameSchema.safeParse(context.sent[0]).success).toBe(true)
      expect(context.closed).toHaveLength(1)
      expect(context.publisher.subscriptionCount()).toBe(0)
      expect(context.watchSink.apply).not.toHaveBeenCalled()
      expect(context.received).toEqual([])
    }
  })

  it('registers watch interests only after ready and scopes the change stream to them', () => {
    const { session, watchSink, onProjectScopeChanged, publisher, sent } = openedSession()

    session.receive(JSON.stringify(sessionWatchesFixtures.watches))

    expect(watchSink.apply).toHaveBeenCalledWith({
      projectPath: PROJECT,
      files: ['/synthetic/repo/src/open-document.ts'],
      dirs: ['/synthetic/repo/src'],
    })
    expect(onProjectScopeChanged).toHaveBeenLastCalledWith(PROJECT)

    publisher.publish({ kind: 'files.scope-changed', projectPath: PROJECT })
    publisher.publish({ kind: 'files.scope-changed', projectPath: '/synthetic/other-repo' })

    expect(changeFrames(sent)).toEqual([
      {
        t: 'session:change',
        epoch: EPOCH,
        sequence: 0,
        change: { kind: 'files.scope-changed', projectPath: PROJECT },
      },
    ])
  })

  it('shares one canonical watch scope and clears it after an invalid re-registration', () => {
    const { session, watchSink, onProjectScopeChanged, publisher, sent } = openedSession()

    session.receive(
      JSON.stringify({
        ...sessionWatchesFixtures.watches,
        projectPath: `${PROJECT}/`,
      }),
    )

    expect(onProjectScopeChanged).toHaveBeenLastCalledWith(PROJECT)
    publisher.publish({ kind: 'files.content-changed', projectPath: PROJECT, paths: ['.'] })
    expect(changeFrames(sent)).toHaveLength(1)

    session.receive(
      JSON.stringify({
        ...sessionWatchesFixtures.watches,
        projectPath: 'synthetic/repo',
      }),
    )

    expect(watchSink.clear).toHaveBeenCalledTimes(1)
    expect(onProjectScopeChanged).toHaveBeenLastCalledWith(undefined)
    publisher.publish({ kind: 'files.content-changed', projectPath: PROJECT, paths: ['.'] })
    expect(changeFrames(sent)).toHaveLength(1)
  })

  it('receives nothing until it declares a project', () => {
    const { publisher, sent } = openedSession()

    publisher.publish({ kind: 'files.scope-changed', projectPath: PROJECT })

    expect(changeFrames(sent)).toEqual([])
  })

  it('forwards terminal traffic on its own path, never through the change union', () => {
    const { session, received, sent, publisher } = openedSession()
    session.receive(JSON.stringify(sessionWatchesFixtures.watches))

    session.receive(JSON.stringify(terminalStreamFixtures.input.write))
    publisher.publish({ kind: 'files.scope-changed', projectPath: PROJECT })
    session.sendTerminalFrame(terminalStreamFixtures.output.data)
    publisher.publish({ kind: 'files.scope-changed', projectPath: PROJECT })

    expect(received).toEqual([terminalStreamFixtures.input.write])
    // Terminal output keeps its own order beside the change stream and consumes no sequence.
    expect(sent.slice(1)).toEqual([
      {
        t: 'session:change',
        epoch: EPOCH,
        sequence: 0,
        change: { kind: 'files.scope-changed', projectPath: PROJECT },
      },
      terminalStreamFixtures.output.data,
      {
        t: 'session:change',
        epoch: EPOCH,
        sequence: 1,
        change: { kind: 'files.scope-changed', projectPath: PROJECT },
      },
    ])
  })

  it('drops frames the session contract does not accept from a client', () => {
    const { session, received, sent, watchSink } = openedSession()

    // A daemon-authored reply, a second hello, and malformed JSON are all refused inbound.
    session.receive(JSON.stringify(terminalStreamFixtures.lifecycle.attached))
    session.receive(JSON.stringify(sessionContractFixtures.hello))
    session.receive('{')

    expect(received).toEqual([])
    expect(sent).toHaveLength(1)
    expect(watchSink.apply).not.toHaveBeenCalled()
  })

  it('releases subscription, watchers, and terminals on close', () => {
    const { session, publisher, watchSink, terminal, sent } = openedSession()
    session.receive(JSON.stringify(sessionWatchesFixtures.watches))

    session.close()
    session.close()

    expect(publisher.subscriptionCount()).toBe(0)
    expect(watchSink.clear).toHaveBeenCalledTimes(1)
    expect(terminal.detach).toHaveBeenCalledTimes(1)
    expect(session.isOpen()).toBe(false)

    publisher.publish({ kind: 'files.scope-changed', projectPath: PROJECT })
    session.receive(JSON.stringify(terminalStreamFixtures.input.write))
    session.sendTerminalFrame(terminalStreamFixtures.output.data)

    expect(changeFrames(sent)).toEqual([])
    expect(sent).toHaveLength(1)
  })
})
