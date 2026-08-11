import { PROTOCOL_VERSION } from '@porcelain/contracts'
import {
  SESSION_WATCH_INTEREST_LIMIT,
  type SessionChange,
  type SessionHelloFrame,
  type SessionMismatchFrame,
  type SessionWatchesFrame,
  sessionContractFixtures,
  sessionHelloFrameSchema,
  sessionWatchesFrameSchema,
} from '@porcelain/contracts/session'
import { terminalStreamFixtures } from '@porcelain/contracts/terminal'
import { describe, expect, it } from 'vitest'
import {
  createSessionClientRuntime,
  type SessionClientRuntime,
  type TerminalServerFrame,
} from './client-runtime'
import type { FreshnessRequirement } from './recovery'

const EPOCH = 'synthetic-epoch'
const PROJECT = '/synthetic/repo'

/** Everything this runtime is allowed to put on the wire. */
type OutboundFrame = SessionHelloFrame | SessionWatchesFrame

function parseOutboundFrame(payload: string): OutboundFrame {
  const json: unknown = JSON.parse(payload)
  const hello = sessionHelloFrameSchema.safeParse(json)
  if (hello.success) return hello.data
  return sessionWatchesFrameSchema.parse(json)
}

type Harness = {
  readonly runtime: SessionClientRuntime
  readonly sent: OutboundFrame[]
  readonly changes: SessionChange[]
  readonly terminal: TerminalServerFrame[]
  readonly requirements: FreshnessRequirement[]
  readonly updateRequired: SessionMismatchFrame[]
  readonly log: string[]
  readonly connect: () => void
  readonly deliver: (frame: unknown) => void
}

function harness(): Harness {
  const sent: OutboundFrame[] = []
  const changes: SessionChange[] = []
  const terminal: TerminalServerFrame[] = []
  const requirements: FreshnessRequirement[] = []
  const updateRequired: SessionMismatchFrame[] = []
  const log: string[] = []

  const runtime = createSessionClientRuntime({
    observer: {
      onChange(change) {
        changes.push(change)
        log.push(`change:${change.kind}`)
      },
      onTerminalFrame(frame) {
        terminal.push(frame)
        log.push(`terminal:${frame.t}`)
      },
      onFreshnessRequired(requirement) {
        requirements.push(requirement)
        log.push(`freshness:${requirement.reason}`)
      },
      onUpdateRequired(frame) {
        updateRequired.push(frame)
        log.push('update-required')
      },
    },
  })

  const transport = {
    send(payload: string) {
      // Every outbound frame crosses the contract, so a client cannot ship a frame the daemon
      // never agreed to accept.
      const frame = parseOutboundFrame(payload)
      sent.push(frame)
      log.push(`sent:${frame.t}`)
    },
  }

  return {
    runtime,
    sent,
    changes,
    terminal,
    requirements,
    updateRequired,
    log,
    connect: () => runtime.connected(transport),
    deliver: (frame) => runtime.receive(JSON.stringify(frame)),
  }
}

function readyFrame(epoch = EPOCH) {
  return { t: 'session:ready', protocolVersion: PROTOCOL_VERSION, epoch }
}

function changeFrame({
  epoch = EPOCH,
  sequence,
  projectPath = PROJECT,
}: {
  epoch?: string
  sequence: number
  projectPath?: string
}) {
  return {
    t: 'session:change',
    epoch,
    sequence,
    change: { kind: 'board.changed', projectPath },
  }
}

/** A runtime that has declared its project and completed one handshake. */
function openRuntime(): Harness {
  const context = harness()
  context.runtime.selectProject(PROJECT)
  context.connect()
  context.deliver(readyFrame())
  return context
}

describe('Session client runtime handshake', () => {
  it('announces this build protocol as the first frame on a connection', () => {
    const { runtime, connect, sent } = harness()

    connect()

    expect(sent).toEqual([{ t: 'session:hello', protocolVersion: PROTOCOL_VERSION }])
    expect(runtime.status()).toBe('handshaking')
  })

  it('registers watches after ready even when no consumer holds an interest', () => {
    const { runtime, sent, log } = openRuntime()

    expect(runtime.status()).toBe('open')
    expect(runtime.epoch()).toBe(EPOCH)
    // A session that never sends watches receives no change frames at all, so an empty desired
    // set is a message, not an optimization to skip.
    expect(sent[1]).toEqual({ t: 'session:watches', projectPath: PROJECT, files: [], dirs: [] })
    expect(log).toEqual(['sent:session:hello', 'sent:session:watches'])
  })

  it('waits for a project before registering, then registers when one is selected', () => {
    const context = harness()
    context.connect()
    context.deliver(readyFrame())

    expect(context.sent).toEqual([{ t: 'session:hello', protocolVersion: PROTOCOL_VERSION }])

    context.runtime.selectProject(PROJECT)

    expect(context.sent[1]).toEqual({
      t: 'session:watches',
      projectPath: PROJECT,
      files: [],
      dirs: [],
    })
  })

  it('requires no refresh for the first connection', () => {
    const { requirements } = openRuntime()

    expect(requirements).toEqual([])
  })
})

describe('Session client runtime change stream', () => {
  it('applies contiguous changes without requiring a refresh', () => {
    const context = openRuntime()

    context.deliver(changeFrame({ sequence: 0 }))
    context.deliver(changeFrame({ sequence: 1 }))

    expect(context.changes).toEqual([
      { kind: 'board.changed', projectPath: PROJECT },
      { kind: 'board.changed', projectPath: PROJECT },
    ])
    expect(context.requirements).toEqual([])
  })

  it('marks the affected project stale on a sequence gap and still applies the change', () => {
    const context = openRuntime()
    context.deliver(changeFrame({ sequence: 0 }))

    context.deliver(changeFrame({ sequence: 5 }))

    expect(context.requirements).toEqual([
      { reason: 'sequence-gap', scope: { kind: 'project', projectPath: PROJECT } },
    ])
    // Stale first, then the signal — never a reconstruction of what the gap hid.
    expect(context.log.slice(-2)).toEqual(['freshness:sequence-gap', 'change:board.changed'])
    expect(context.changes).toHaveLength(2)
  })

  it('re-registers watches and then requires a session refresh on reconnect', () => {
    const context = openRuntime()
    context.deliver(changeFrame({ sequence: 0 }))

    context.runtime.disconnected()
    expect(context.runtime.status()).toBe('disconnected')
    context.connect()
    context.deliver(readyFrame())

    expect(context.requirements).toEqual([{ reason: 'reconnect', scope: { kind: 'session' } }])
    // Interests are restored before the adapter refetches, or the refreshed data is uncovered.
    expect(context.log.slice(-3)).toEqual([
      'sent:session:hello',
      'sent:session:watches',
      'freshness:reconnect',
    ])
  })

  it('does not read the daemon restarting a subscription sequence as a gap', () => {
    const context = openRuntime()
    context.deliver(changeFrame({ sequence: 4 }))
    context.runtime.disconnected()
    context.connect()
    context.deliver(readyFrame())

    context.deliver(changeFrame({ sequence: 0 }))
    context.deliver(changeFrame({ sequence: 1 }))

    expect(context.requirements).toEqual([{ reason: 'reconnect', scope: { kind: 'session' } }])
    expect(context.changes).toHaveLength(3)
  })

  it('requires a session refresh when the daemon instance changed', () => {
    const context = openRuntime()
    context.runtime.disconnected()
    context.connect()

    context.deliver(readyFrame('synthetic-epoch-2'))

    expect(context.requirements).toEqual([{ reason: 'epoch-changed', scope: { kind: 'session' } }])
    expect(context.runtime.epoch()).toBe('synthetic-epoch-2')
  })

  it('ignores frames that do not validate, and change frames before ready', () => {
    const context = harness()
    context.runtime.selectProject(PROJECT)
    context.connect()

    context.deliver(changeFrame({ sequence: 0 }))
    context.runtime.receive('not json at all')

    expect(context.changes).toEqual([])
    expect(context.runtime.status()).toBe('handshaking')

    context.deliver(readyFrame())
    context.runtime.receive('{ broken')
    context.deliver({ t: 'session:change', epoch: EPOCH, sequence: 0 })
    context.deliver({ t: 'session:unknown', epoch: EPOCH })
    context.deliver({ ...changeFrame({ sequence: 0 }), repo: '/elsewhere' })

    expect(context.changes).toEqual([])
    expect(context.requirements).toEqual([])
    expect(context.runtime.status()).toBe('open')
  })
})

describe('Session client runtime terminal stream', () => {
  it('delivers terminal frames in arrival order without consuming a change sequence', () => {
    const context = openRuntime()

    context.deliver(terminalStreamFixtures.lifecycle.attached)
    context.deliver(changeFrame({ sequence: 0 }))
    context.deliver(terminalStreamFixtures.output.data)
    context.deliver(terminalStreamFixtures.lifecycle.exit)
    context.deliver(changeFrame({ sequence: 1 }))

    expect(context.terminal.map((frame) => frame.t)).toEqual([
      'terminal:attached',
      'terminal:data',
      'terminal:exit',
    ])
    // A chatty shell must never look like a gap in the change stream.
    expect(context.requirements).toEqual([])
    expect(context.log).toEqual([
      'sent:session:hello',
      'sent:session:watches',
      'terminal:terminal:attached',
      'change:board.changed',
      'terminal:terminal:data',
      'terminal:terminal:exit',
      'change:board.changed',
    ])
  })

  it('refuses a client-authored terminal frame arriving from the daemon', () => {
    const context = openRuntime()

    context.deliver(terminalStreamFixtures.input.write)

    expect(context.terminal).toEqual([])
  })
})

describe('Session client runtime protocol mismatch', () => {
  it('reports update-required once and never retries the handshake', () => {
    const context = harness()
    context.runtime.selectProject(PROJECT)
    context.connect()

    context.deliver(sessionContractFixtures.mismatch)

    expect(context.updateRequired).toEqual([sessionContractFixtures.mismatch])
    expect(context.runtime.status()).toBe('update-required')

    // Terminal: a reconnect attempt sends nothing, and no later frame is accepted.
    context.runtime.disconnected()
    context.connect()
    context.deliver(readyFrame())
    context.deliver(changeFrame({ sequence: 0 }))

    expect(context.runtime.status()).toBe('update-required')
    expect(context.sent).toEqual([{ t: 'session:hello', protocolVersion: PROTOCOL_VERSION }])
    expect(context.changes).toEqual([])
    expect(context.updateRequired).toHaveLength(1)
  })
})

describe('Session client runtime interests', () => {
  it('re-registers the merged set when a consumer declares or releases an interest', () => {
    const context = openRuntime()

    const first = context.runtime.registerWatchInterest({
      files: [`${PROJECT}/src/a.ts`],
      dirs: [`${PROJECT}/src`],
    })
    context.runtime.registerWatchInterest({ files: [`${PROJECT}/src/b.ts`], dirs: [] })

    expect(context.sent.at(-1)).toEqual({
      t: 'session:watches',
      projectPath: PROJECT,
      files: [`${PROJECT}/src/a.ts`, `${PROJECT}/src/b.ts`],
      dirs: [`${PROJECT}/src`],
    })

    first.release()

    expect(context.sent.at(-1)).toEqual({
      t: 'session:watches',
      projectPath: PROJECT,
      files: [`${PROJECT}/src/b.ts`],
      dirs: [],
    })
  })

  it('restores the held interests after a reconnect', () => {
    const context = openRuntime()
    context.runtime.registerWatchInterest({ files: [`${PROJECT}/src/a.ts`], dirs: [] })

    context.runtime.disconnected()
    context.connect()
    context.deliver(readyFrame())

    expect(context.sent.at(-1)).toEqual({
      t: 'session:watches',
      projectPath: PROJECT,
      files: [`${PROJECT}/src/a.ts`],
      dirs: [],
    })
  })

  it('never submits more interests than the daemon accepts', () => {
    const context = openRuntime()

    context.runtime.registerWatchInterest({
      files: Array.from({ length: 200 }, (_, index) => `${PROJECT}/file-${index}.ts`),
      dirs: Array.from({ length: 200 }, (_, index) => `${PROJECT}/dir-${index}`),
    })

    const frame = context.sent.at(-1)
    if (frame?.t !== 'session:watches') throw new Error('expected a watch registration')
    expect(frame.files.length + frame.dirs.length).toBe(SESSION_WATCH_INTEREST_LIMIT)
  })

  it('holds interests declared before the handshake and sends nothing until ready', () => {
    const context = harness()
    context.runtime.selectProject(PROJECT)
    context.runtime.registerWatchInterest({ files: [`${PROJECT}/src/a.ts`], dirs: [] })

    expect(context.sent).toEqual([])

    context.connect()
    context.deliver(readyFrame())

    expect(context.sent).toEqual([
      { t: 'session:hello', protocolVersion: PROTOCOL_VERSION },
      {
        t: 'session:watches',
        projectPath: PROJECT,
        files: [`${PROJECT}/src/a.ts`],
        dirs: [],
      },
    ])
  })
})
