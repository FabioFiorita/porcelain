import {
  type SessionChange,
  type SessionChangeFrame,
  sessionChangeFrameSchema,
  sessionChangeSchema,
} from '@porcelain/contracts/session'
import { describe, expect, it, vi } from 'vitest'
import {
  createSessionChangePublisher,
  SESSION_CHANGE_CATEGORIES,
  type SessionChangeSource,
  sessionChangeCategory,
} from './change-publisher'

const EPOCH = 'synthetic-epoch'
const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other-repo'

function change(projectPath: string): SessionChange {
  return { kind: 'board.changed', projectPath }
}

/** The daemon-wide change: its contract carries no project, which is what makes it global. */
const DAEMON_WIDE_CHANGE: SessionChange = { kind: 'tasks.changed' }

/** One valid change per contract kind, so tests cover the union without hand-listing it. */
function changesForEveryKind(projectPath: string): SessionChange[] {
  return sessionChangeSchema.options.map((option) => {
    const kind = option.shape.kind.value
    // `tasks.changed` is strict and daemon-wide: adding projectPath would fail the contract.
    if (kind === 'tasks.changed') return sessionChangeSchema.parse({ kind })
    return sessionChangeSchema.parse(
      kind === 'files.tree-changed' || kind === 'files.content-changed'
        ? { kind, projectPath, paths: ['a.ts'] }
        : { kind, projectPath },
    )
  })
}

function subscriberSpy() {
  const frames: SessionChangeFrame[] = []
  return { frames, subscriber: { deliver: (frame: SessionChangeFrame) => frames.push(frame) } }
}

describe('Session change publisher', () => {
  it('sequences a scoped subscription from zero within one epoch', () => {
    const publisher = createSessionChangePublisher({ epoch: EPOCH })
    const { frames, subscriber } = subscriberSpy()
    publisher.subscribe(subscriber).scopeToProject(PROJECT)

    publisher.publish(change(PROJECT))
    publisher.publish(change(PROJECT))
    publisher.publish(change(PROJECT))

    expect(frames.map((frame) => frame.sequence)).toEqual([0, 1, 2])
    expect(frames.every((frame) => frame.epoch === EPOCH)).toBe(true)
  })

  it('emits only frames the session contract accepts', () => {
    const publisher = createSessionChangePublisher({ epoch: EPOCH })
    const { frames, subscriber } = subscriberSpy()
    publisher.subscribe(subscriber).scopeToProject(PROJECT)

    for (const emitted of changesForEveryKind(PROJECT)) {
      expect(publisher.publish(emitted)).toEqual({ ok: true, delivered: 1 })
    }

    expect(frames).toHaveLength(sessionChangeSchema.options.length)
    for (const frame of frames) expect(sessionChangeFrameSchema.parse(frame)).toEqual(frame)
  })

  it('gives each subscription its own gapless sequence', () => {
    // A daemon-wide counter would show every session a gap whenever another project changed,
    // and decision 009 reads a gap as proof the client missed a notification.
    const publisher = createSessionChangePublisher({ epoch: EPOCH })
    const first = subscriberSpy()
    const second = subscriberSpy()
    publisher.subscribe(first.subscriber).scopeToProject(PROJECT)
    const other = publisher.subscribe(second.subscriber)
    other.scopeToProject(OTHER_PROJECT)

    publisher.publish(change(PROJECT))
    publisher.publish(change(OTHER_PROJECT))
    publisher.publish(change(PROJECT))

    expect(first.frames.map((frame) => frame.sequence)).toEqual([0, 1])
    expect(second.frames.map((frame) => frame.sequence)).toEqual([0])
  })

  it('restarts sequences under a new epoch', () => {
    const replaced = createSessionChangePublisher({ epoch: 'synthetic-epoch-2' })
    const { frames, subscriber } = subscriberSpy()
    replaced.subscribe(subscriber).scopeToProject(PROJECT)

    replaced.publish(change(PROJECT))

    expect(frames).toEqual([
      { t: 'session:change', epoch: 'synthetic-epoch-2', sequence: 0, change: change(PROJECT) },
    ])
  })

  it('delivers nothing to an unscoped subscription', () => {
    const publisher = createSessionChangePublisher({ epoch: EPOCH })
    const { frames, subscriber } = subscriberSpy()
    publisher.subscribe(subscriber)

    expect(publisher.publish(change(PROJECT))).toEqual({ ok: true, delivered: 0 })
    expect(frames).toEqual([])
  })

  it('never delivers another project’s change', () => {
    const publisher = createSessionChangePublisher({ epoch: EPOCH })
    const { frames, subscriber } = subscriberSpy()
    publisher.subscribe(subscriber).scopeToProject(PROJECT)

    expect(publisher.publish(change(OTHER_PROJECT))).toEqual({ ok: true, delivered: 0 })
    expect(frames).toEqual([])
  })

  it('delivers a daemon-wide change to every open subscription', () => {
    // A change whose contract carries no projectPath belongs to the daemon, not a checkout:
    // withholding it would leave the one deliberately global surface unable to refresh.
    const publisher = createSessionChangePublisher({ epoch: EPOCH })
    const scoped = subscriberSpy()
    const elsewhere = subscriberSpy()
    const unscoped = subscriberSpy()
    publisher.subscribe(scoped.subscriber).scopeToProject(PROJECT)
    publisher.subscribe(elsewhere.subscriber).scopeToProject(OTHER_PROJECT)
    publisher.subscribe(unscoped.subscriber)

    expect(publisher.publish(DAEMON_WIDE_CHANGE)).toEqual({ ok: true, delivered: 3 })

    for (const spy of [scoped, elsewhere, unscoped]) {
      expect(spy.frames.map((frame) => frame.change)).toEqual([DAEMON_WIDE_CHANGE])
      expect(spy.frames.map((frame) => frame.sequence)).toEqual([0])
    }
  })

  it('keeps a project-scoped change scoped while daemon-wide changes reach everyone', () => {
    const publisher = createSessionChangePublisher({ epoch: EPOCH })
    const scoped = subscriberSpy()
    const elsewhere = subscriberSpy()
    const unscoped = subscriberSpy()
    publisher.subscribe(scoped.subscriber).scopeToProject(PROJECT)
    publisher.subscribe(elsewhere.subscriber).scopeToProject(OTHER_PROJECT)
    publisher.subscribe(unscoped.subscriber)

    expect(publisher.publish(change(PROJECT))).toEqual({ ok: true, delivered: 1 })
    expect(publisher.publish(DAEMON_WIDE_CHANGE)).toEqual({ ok: true, delivered: 3 })

    expect(scoped.frames.map((frame) => frame.change)).toEqual([
      change(PROJECT),
      DAEMON_WIDE_CHANGE,
    ])
    expect(scoped.frames.map((frame) => frame.sequence)).toEqual([0, 1])
    expect(elsewhere.frames.map((frame) => frame.change)).toEqual([DAEMON_WIDE_CHANGE])
    expect(unscoped.frames.map((frame) => frame.change)).toEqual([DAEMON_WIDE_CHANGE])
  })

  it('rejects a change the contract does not accept', () => {
    const publisher = createSessionChangePublisher({ epoch: EPOCH })
    const { frames, subscriber } = subscriberSpy()
    publisher.subscribe(subscriber).scopeToProject(PROJECT)

    expect(publisher.publish({ kind: 'board.changed' })).toEqual({
      ok: false,
      error: { code: 'session.invalid-change' },
    })
    expect(publisher.publish({ kind: 'terminal:data', projectPath: PROJECT, data: 'x' })).toEqual({
      ok: false,
      error: { code: 'session.invalid-change' },
    })
    expect(frames).toEqual([])
  })

  it('stops delivering to a closed subscription', () => {
    const publisher = createSessionChangePublisher({ epoch: EPOCH })
    const { frames, subscriber } = subscriberSpy()
    const subscription = publisher.subscribe(subscriber)
    subscription.scopeToProject(PROJECT)

    publisher.publish(change(PROJECT))
    subscription.close()
    subscription.close()
    publisher.publish(change(PROJECT))

    expect(frames).toHaveLength(1)
    expect(publisher.subscriptionCount()).toBe(0)
  })

  it('drops a throwing subscriber without failing other best-effort deliveries', () => {
    const publisher = createSessionChangePublisher({ epoch: EPOCH })
    publisher
      .subscribe({
        deliver() {
          throw new Error('socket closed')
        },
      })
      .scopeToProject(PROJECT)
    const healthy = subscriberSpy()
    publisher.subscribe(healthy.subscriber).scopeToProject(PROJECT)

    expect(publisher.publish(change(PROJECT))).toEqual({ ok: true, delivered: 1 })
    expect(healthy.frames.map((frame) => frame.sequence)).toEqual([0])
    expect(publisher.subscriptionCount()).toBe(1)
  })

  describe('source-to-category mapping', () => {
    it('maps every contract change kind to a declared category', () => {
      expect([...SESSION_CHANGE_CATEGORIES]).toEqual([
        'files',
        'git',
        'review',
        'board',
        'actions',
        'tasks',
      ])
      const changes = changesForEveryKind(PROJECT)
      const categories = changes.map((observed) => sessionChangeCategory(observed))

      expect(new Set(categories)).toEqual(new Set(SESSION_CHANGE_CATEGORIES))
      for (const [index, observed] of changes.entries()) {
        expect(observed.kind.startsWith(`${categories[index]}.`)).toBe(true)
      }
    })

    it('publishes what a connected source observes', () => {
      const publisher = createSessionChangePublisher({ epoch: EPOCH })
      const { frames, subscriber } = subscriberSpy()
      publisher.subscribe(subscriber).scopeToProject(PROJECT)

      let emit: ((observed: SessionChange) => void) | undefined
      const release = vi.fn()
      const source: SessionChangeSource = {
        category: 'board',
        observe: (next) => {
          emit = next
          return release
        },
      }

      const disconnect = publisher.connectSource(source)
      emit?.(change(PROJECT))
      expect(frames.map((frame) => frame.change)).toEqual([change(PROJECT)])

      disconnect()
      expect(release).toHaveBeenCalledTimes(1)
    })

    it('refuses a change from outside the source’s own category', () => {
      const publisher = createSessionChangePublisher({ epoch: EPOCH })
      const { frames, subscriber } = subscriberSpy()
      publisher.subscribe(subscriber).scopeToProject(PROJECT)
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

      let emit: ((observed: SessionChange) => void) | undefined
      publisher.connectSource({
        category: 'git',
        observe: (next) => {
          emit = next
          return () => {}
        },
      })
      emit?.(change(PROJECT))

      expect(frames).toEqual([])
      expect(logged).toHaveBeenCalledTimes(1)
      logged.mockRestore()
    })
  })
})
