import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AgentEvent } from '../../shared/agent-protocol'
import { type AppEvent, subscribeAppEvents } from '../app-events'
import {
  type AgentSender,
  abortTurn,
  attachThread,
  cancelQueued,
  createThread,
  deleteThread,
  detachThread,
  flushThread,
  listThreads,
  providerStatuses,
  renameThread,
  resetForTests,
  respondApproval,
  sendMessage,
  setDrivers,
  updateThread,
} from './agent-manager'
import { readThread } from './thread-store'
import type { AgentDriver, DriverRegistry, StartTurnOptions } from './types'

const dir = join(tmpdir(), 'porcelain-agent-manager-test')

// A controllable driver: it records the last turn's options so a test can drive `emit`
// / `onDone` by hand, plus the abort/approval calls it received.
class MockDriver implements AgentDriver {
  provider = 'claude' as const
  last: StartTurnOptions | null = null
  starts = 0
  aborts = 0
  approvals: { requestId: string; decision: string }[] = []
  installed = true
  // Optional LLM-title hook — absent by default (matching a driver that offers none); a
  // titling test assigns it. The same object backs the registry, so a later assignment
  // reaches the manager.
  generateTitle?: (opts: { repoPath: string; text: string }) => Promise<string | null>

  async status() {
    return {
      provider: this.provider,
      installed: this.installed,
      authenticated: true,
      models: [{ id: 'sonnet', label: 'Sonnet', provider: this.provider }],
    }
  }

  startTurn(opts: StartTurnOptions) {
    this.last = opts
    this.starts += 1
    return {
      abort: () => {
        this.aborts += 1
      },
      respondApproval: (requestId: string, decision: string) => {
        this.approvals.push({ requestId, decision })
      },
    }
  }
}

// A driver whose status() throws — exercises providerStatuses' per-driver tolerance.
const throwingDriver: AgentDriver = {
  provider: 'codex',
  status() {
    throw new Error('CLI blew up')
  },
  startTurn() {
    return { abort() {}, respondApproval() {} }
  },
}

let mock: MockDriver

function registry(claude: AgentDriver): DriverRegistry {
  return { claude, codex: throwingDriver, opencode: throwingDriver, grok: throwingDriver }
}

// A sender that just records every fanned-out event.
function recordingSender(): AgentSender & { events: AgentEvent[] } {
  const events: AgentEvent[] = []
  return {
    events,
    send(_channel, ...args) {
      events.push(args[1] as AgentEvent)
    },
    isDestroyed: () => false,
  }
}

beforeEach(() => {
  process.env.PORCELAIN_AGENT_THREADS = dir
  rmSync(dir, { recursive: true, force: true })
  resetForTests()
  mock = new MockDriver()
  setDrivers(registry(mock))
})
afterEach(() => {
  delete process.env.PORCELAIN_AGENT_THREADS
  rmSync(dir, { recursive: true, force: true })
  resetForTests()
})

const newThread = () =>
  createThread({ repoPath: '/repo', provider: 'claude', model: 'sonnet', mode: 'full' })

describe('agent-manager', () => {
  it('creates a thread, persists it, and lists it', async () => {
    const info = await newThread()
    expect(info).toMatchObject({ repoPath: '/repo', provider: 'claude', status: 'idle' })
    expect(await readThread(info.id)).not.toBeNull()
    expect((await listThreads('/repo')).map((t) => t.id)).toEqual([info.id])
  })

  it('keeps repos isolated in the roster', async () => {
    await newThread()
    await createThread({ repoPath: '/other', provider: 'claude', model: 'sonnet', mode: 'full' })
    expect(await listThreads('/repo')).toHaveLength(1)
    expect(await listThreads('/other')).toHaveLength(1)
  })

  it('sendMessage appends a user item, goes working, and calls the driver', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'do a thing' })
    expect(mock.last?.text).toBe('do a thing')
    const stored = await readThread(id)
    expect(stored?.items).toEqual([{ kind: 'user', id: expect.any(String), text: 'do a thing' }])
    expect((await listThreads('/repo'))[0]?.status).toBe('working')
  })

  it('auto-titles from the first user message only', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'Fix the retry loop\nand add a test' })
    expect((await listThreads('/repo'))[0]?.title).toBe('Fix the retry loop')
    // A second send (queued behind the running turn) must not retitle.
    await sendMessage(id, { text: 'another' })
    expect((await listThreads('/repo'))[0]?.title).toBe('Fix the retry loop')
  })

  it('records imageCount on the user item', async () => {
    const { id } = await newThread()
    await sendMessage(id, {
      text: 'look',
      images: [{ mediaType: 'image/png', base64: 'AAAA' }],
    })
    const stored = await readThread(id)
    expect(stored?.items[0]).toMatchObject({ kind: 'user', imageCount: 1 })
  })

  it('queues a second send while working instead of starting a second turn', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'first' })
    const firstTurnOpts = mock.last
    await sendMessage(id, { text: 'second' })
    expect(mock.last).toBe(firstTurnOpts) // startTurn not called again
    // No error item — the second message is queued (text + count on the roster).
    const stored = await readThread(id)
    expect(stored?.items.map((i) => i.kind)).toEqual(['user'])
    expect(stored?.queued).toEqual({ text: 'second' })
    expect((await listThreads('/repo'))[0]?.queued).toEqual({ text: 'second' })
  })

  it('reduces driver events into the timeline and returns to idle onDone', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'go' })
    const opts = mock.last
    if (!opts) throw new Error('expected a started turn')
    opts.emit({ t: 'item', item: { kind: 'assistant', id: 'a1', text: 'Hel', streaming: true } })
    opts.emit({ t: 'item-delta', id: 'a1', delta: 'lo' })
    opts.emit({ t: 'item', item: { kind: 'assistant', id: 'a1', text: 'Hello', streaming: false } })
    opts.onDone({ ok: true })
    await flushThread(id)
    const stored = await readThread(id)
    expect(stored?.items).toEqual([
      { kind: 'user', id: expect.any(String), text: 'go' },
      { kind: 'assistant', id: 'a1', text: 'Hello', streaming: false },
    ])
    expect((await listThreads('/repo'))[0]?.status).toBe('idle')
  })

  it('persists driver session state for the next turn to resume', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'go' })
    mock.last?.onSessionState({ resume: 'sess-1' })
    mock.last?.onDone({ ok: true })
    await flushThread(id)
    expect((await readThread(id))?.sessionState).toEqual({ resume: 'sess-1' })
    // The next turn is handed the resumed state.
    await sendMessage(id, { text: 'again' })
    expect(mock.last?.resume).toEqual({ resume: 'sess-1' })
  })

  it('records a driver meta resolvedModel on the thread without touching the chosen model', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'go' })
    mock.last?.emit({ t: 'meta', resolvedModel: 'claude-opus-4-8-20260115' })
    mock.last?.onDone({ ok: true })
    await flushThread(id)
    const stored = await readThread(id)
    expect(stored?.meta.resolvedModel).toBe('claude-opus-4-8-20260115')
    // The user's chosen model is a separate field, untouched by the resolved report.
    expect(stored?.meta.model).toBe('sonnet')
  })

  it('fans turn events out to attached senders only', async () => {
    const { id } = await newThread()
    const sender = recordingSender()
    const attach = await attachThread(id, sender)
    expect(attach).toMatchObject({ found: true, status: 'idle' })
    await sendMessage(id, { text: 'go' })
    mock.last?.emit({
      t: 'item',
      item: { kind: 'assistant', id: 'a1', text: 'hi', streaming: false },
    })
    // The user item, the manager's working flip, and the assistant item all fan out.
    expect(sender.events.map((e) => e.t)).toEqual(['item', 'status', 'item'])
    detachThread(id, sender)
    mock.last?.emit({ t: 'item', item: { kind: 'error', id: 'e1', message: 'boom' } })
    expect(sender.events).toHaveLength(3) // nothing after detach
  })

  it('fans the working flip on send and the idle flip on done to attached senders', async () => {
    const { id } = await newThread()
    const sender = recordingSender()
    await attachThread(id, sender)
    await sendMessage(id, { text: 'go' })
    const statusesAfterSend = sender.events
      .filter((e) => e.t === 'status')
      .map((e) => (e.t === 'status' ? e.status : ''))
    expect(statusesAfterSend).toEqual(['working'])
    mock.last?.onDone({ ok: true })
    const allStatuses = sender.events
      .filter((e) => e.t === 'status')
      .map((e) => (e.t === 'status' ? e.status : ''))
    expect(allStatuses).toEqual(['working', 'idle'])
  })

  it('claims the turn synchronously so a racing second send is queued, not started', async () => {
    const { id } = await newThread()
    // Two sends without awaiting the first — the second must hit the already-working guard
    // (the turn is claimed synchronously) and be queued rather than start a second turn.
    const first = sendMessage(id, { text: 'first' })
    const second = sendMessage(id, { text: 'second' })
    await Promise.all([first, second])
    expect(mock.starts).toBe(1) // exactly one driver turn started
    await flushThread(id)
    const stored = await readThread(id)
    expect(stored?.items.map((i) => i.kind)).toEqual(['user'])
    expect(stored?.queued).toEqual({ text: 'second' })
  })

  it('does not resurrect the thread file when a debounced persist was pending', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'go' })
    // A driver emit schedules a trailing (debounced) persist that hasn't fired yet.
    mock.last?.emit({
      t: 'item',
      item: { kind: 'assistant', id: 'a1', text: 'hi', streaming: false },
    })
    await deleteThread(id)
    // Give the (now-cancelled) debounce well past its ~500ms window to prove it can't write.
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(await readThread(id)).toBeNull()
  })

  it('attach replays the current timeline snapshot', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'go' })
    const sender = recordingSender()
    const result = await attachThread(id, sender)
    expect(result.found).toBe(true)
    expect(result.items.map((i) => i.kind)).toEqual(['user'])
    expect(result.status).toBe('working')
  })

  it('reports found=false for an unknown thread', async () => {
    const result = await attachThread('nope', recordingSender())
    expect(result).toEqual({ found: false, items: [], status: 'idle' })
  })

  it('aborts a running turn back to idle', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'go' })
    await abortTurn(id)
    expect(mock.aborts).toBe(1)
    expect((await listThreads('/repo'))[0]?.status).toBe('idle')
  })

  it('ignores a late callback from an aborted turn, keeping the new turn intact', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'first' })
    const firstOpts = mock.last
    if (!firstOpts) throw new Error('expected a started turn')
    await abortTurn(id)
    // A new turn starts; capture its (distinct) options.
    await sendMessage(id, { text: 'second' })
    const secondOpts = mock.last
    if (!secondOpts || secondOpts === firstOpts) throw new Error('expected a second turn')
    // The aborted turn's process exits late, firing a final emit + onDone.
    firstOpts.emit({
      t: 'item',
      item: { kind: 'assistant', id: 'stale', text: 'stale', streaming: false },
    })
    firstOpts.onDone({ ok: true })
    // The new turn is untouched: still working, no stale item, and its own emit lands.
    expect((await listThreads('/repo'))[0]?.status).toBe('working')
    secondOpts.emit({
      t: 'item',
      item: { kind: 'assistant', id: 'live', text: 'live', streaming: false },
    })
    await flushThread(id)
    const stored = await readThread(id)
    expect(stored?.items).toEqual([
      { kind: 'user', id: expect.any(String), text: 'first' },
      { kind: 'user', id: expect.any(String), text: 'second' },
      { kind: 'assistant', id: 'live', text: 'live', streaming: false },
    ])
  })

  it('routes an approval decision to the running turn', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'go' })
    await respondApproval(id, 'req-1', 'accept-session')
    expect(mock.approvals).toEqual([{ requestId: 'req-1', decision: 'accept-session' }])
  })

  it('renames and updates a thread', async () => {
    const { id } = await newThread()
    await renameThread(id, '  Renamed  ')
    await updateThread(id, { model: 'opus', mode: 'approve' })
    const stored = await readThread(id)
    expect(stored?.meta).toMatchObject({ title: 'Renamed', model: 'opus', mode: 'approve' })
  })

  it('persists thread options and hands them to the next turn', async () => {
    const { id } = await newThread()
    await updateThread(id, { options: { effort: 'high', contextWindow: '1m' } })
    expect((await readThread(id))?.meta.options).toEqual({ effort: 'high', contextWindow: '1m' })
    await sendMessage(id, { text: 'go' })
    expect(mock.last?.options).toEqual({ effort: 'high', contextWindow: '1m' })
  })

  it('passes {} options to the driver for an untouched thread', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'go' })
    expect(mock.last?.options).toEqual({})
  })

  it('persists the interaction mode and hands it to the next turn', async () => {
    const { id } = await newThread()
    await updateThread(id, { interaction: 'plan' })
    expect((await readThread(id))?.meta.interaction).toBe('plan')
    await sendMessage(id, { text: 'go' })
    expect(mock.last?.interaction).toBe('plan')
  })

  it("defaults an untouched thread's interaction to build", async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'go' })
    expect(mock.last?.interaction).toBe('build')
  })

  it('deletes a thread and its file, aborting any running turn', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'go' })
    await deleteThread(id)
    expect(mock.aborts).toBe(1)
    expect(await readThread(id)).toBeNull()
    expect(await listThreads('/repo')).toEqual([])
  })

  it('hydrates threads from disk on a fresh manager', async () => {
    const { id } = await newThread()
    resetForTests() // simulate a daemon restart: empty map, same on-disk dir
    setDrivers(registry(mock))
    expect((await listThreads('/repo')).map((t) => t.id)).toEqual([id])
  })

  it('accumulates token usage across turns (last turn + cumulative total)', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'first' })
    mock.last?.emit({ t: 'status', status: 'idle', usage: { inputTokens: 10, outputTokens: 5 } })
    mock.last?.onDone({ ok: true })
    await flushThread(id)
    expect((await readThread(id))?.meta.usage).toEqual({
      turnInput: 10,
      turnOutput: 5,
      totalInput: 10,
      totalOutput: 5,
    })
    await sendMessage(id, { text: 'second' })
    mock.last?.emit({ t: 'status', status: 'idle', usage: { inputTokens: 20, outputTokens: 8 } })
    mock.last?.onDone({ ok: true })
    await flushThread(id)
    expect((await readThread(id))?.meta.usage).toEqual({
      turnInput: 20,
      turnOutput: 8,
      totalInput: 30,
      totalOutput: 13,
    })
  })

  it('does not double-count when one turn reports usage multiple times', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'go' })
    mock.last?.emit({ t: 'status', status: 'working', usage: { inputTokens: 5, outputTokens: 2 } })
    mock.last?.emit({ t: 'status', status: 'working', usage: { inputTokens: 12, outputTokens: 6 } })
    mock.last?.onDone({ ok: true })
    await flushThread(id)
    expect((await readThread(id))?.meta.usage).toEqual({
      turnInput: 12,
      turnOutput: 6,
      totalInput: 12,
      totalOutput: 6,
    })
  })

  it('accumulates session cost across turns and leaves it untouched by a token-only report', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'first' })
    mock.last?.emit({
      t: 'status',
      status: 'idle',
      usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.25 },
    })
    mock.last?.onDone({ ok: true })
    await flushThread(id)
    expect((await readThread(id))?.meta.usage).toEqual({
      turnInput: 10,
      turnOutput: 5,
      totalInput: 10,
      totalOutput: 5,
      totalCostUsd: 0.25,
    })
    await sendMessage(id, { text: 'second' })
    // A mid-turn token-only report must keep the accumulated cost, not drop it.
    mock.last?.emit({ t: 'status', status: 'working', usage: { inputTokens: 20, outputTokens: 8 } })
    expect((await listThreads('/repo'))[0]?.usage?.totalCostUsd).toBe(0.25)
    mock.last?.emit({
      t: 'status',
      status: 'idle',
      usage: { inputTokens: 20, outputTokens: 8, costUsd: 0.5 },
    })
    mock.last?.onDone({ ok: true })
    await flushThread(id)
    expect((await readThread(id))?.meta.usage?.totalCostUsd).toBe(0.75)
  })

  it('replaces the derived title with an LLM title after the first successful turn', async () => {
    mock.generateTitle = () => Promise.resolve('  LLM Generated Title  ')
    const { id } = await newThread()
    await sendMessage(id, { text: 'fix the thing' })
    expect((await listThreads('/repo'))[0]?.title).toBe('fix the thing') // derived immediately
    mock.last?.onDone({ ok: true })
    await new Promise((resolve) => setTimeout(resolve, 20)) // let the fire-and-forget settle
    expect((await listThreads('/repo'))[0]?.title).toBe('LLM Generated Title')
  })

  it('keeps the derived title when generateTitle returns null', async () => {
    mock.generateTitle = () => Promise.resolve(null)
    const { id } = await newThread()
    await sendMessage(id, { text: 'fix the thing' })
    mock.last?.onDone({ ok: true })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect((await listThreads('/repo'))[0]?.title).toBe('fix the thing')
  })

  it('keeps the derived title when generateTitle throws', async () => {
    mock.generateTitle = () => Promise.reject(new Error('title boom'))
    const { id } = await newThread()
    await sendMessage(id, { text: 'fix the thing' })
    mock.last?.onDone({ ok: true })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect((await listThreads('/repo'))[0]?.title).toBe('fix the thing')
  })

  it('only auto-titles after the first turn, not later ones or a failed turn', async () => {
    let calls = 0
    mock.generateTitle = () => {
      calls += 1
      return Promise.resolve(`Title ${calls}`)
    }
    const { id } = await newThread()
    await sendMessage(id, { text: 'first' })
    mock.last?.onDone({ ok: true })
    await new Promise((resolve) => setTimeout(resolve, 20))
    await sendMessage(id, { text: 'second' })
    mock.last?.onDone({ ok: true })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(calls).toBe(1)
  })

  it('does not auto-title after a failed first turn', async () => {
    let calls = 0
    mock.generateTitle = () => {
      calls += 1
      return Promise.resolve('X')
    }
    const { id } = await newThread()
    await sendMessage(id, { text: 'first' })
    mock.last?.onDone({ ok: false })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(calls).toBe(0)
  })

  it('stamps turnStartedAt when a turn starts and persists it', async () => {
    const before = Date.now()
    const { id } = await newThread()
    expect((await listThreads('/repo'))[0]?.turnStartedAt).toBeUndefined()
    await sendMessage(id, { text: 'go' })
    const startedAt = (await listThreads('/repo'))[0]?.turnStartedAt
    expect(startedAt).toBeGreaterThanOrEqual(before)
    expect((await readThread(id))?.meta.turnStartedAt).toBe(startedAt)
  })

  it('persists downscaled thumbnails on the user item (full images never persisted)', async () => {
    const { id } = await newThread()
    await sendMessage(id, {
      text: 'look',
      images: [{ mediaType: 'image/png', base64: 'FULLDATA' }],
      thumbnails: [{ mediaType: 'image/jpeg', base64: 'THUMB' }],
    })
    const stored = await readThread(id)
    expect(stored?.items[0]).toMatchObject({
      kind: 'user',
      imageCount: 1,
      thumbnails: [{ mediaType: 'image/jpeg', base64: 'THUMB' }],
    })
    // The full-size image is streamed to the CLI live, never written to disk.
    expect(JSON.stringify(stored)).not.toContain('FULLDATA')
  })

  it('flags lastTurnFailed on a failed turn and clears it when the next turn starts', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'go' })
    mock.last?.onDone({ ok: false })
    await flushThread(id)
    expect((await listThreads('/repo'))[0]?.lastTurnFailed).toBe(true)
    expect((await readThread(id))?.meta.lastTurnFailed).toBe(true)
    // A new turn clears the flag.
    await sendMessage(id, { text: 'again' })
    expect((await listThreads('/repo'))[0]?.lastTurnFailed).toBeUndefined()
  })

  it('clears lastTurnFailed on a successful turn', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'go' })
    mock.last?.onDone({ ok: false })
    await sendMessage(id, { text: 'retry' })
    mock.last?.onDone({ ok: true })
    await flushThread(id)
    expect((await listThreads('/repo'))[0]?.lastTurnFailed).toBeUndefined()
  })

  it('auto-runs the queued message when the turn ends OK', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'first' })
    await sendMessage(id, { text: 'queued' }) // queued behind the running turn
    expect(mock.starts).toBe(1)
    mock.last?.onDone({ ok: true })
    await flushThread(id)
    expect(mock.starts).toBe(2) // the queued message started its own turn
    expect(mock.last?.text).toBe('queued')
    const stored = await readThread(id)
    expect(stored?.items.map((i) => i.kind)).toEqual(['user', 'user'])
    expect(stored?.queued).toBeUndefined() // drained
    expect((await listThreads('/repo'))[0]?.status).toBe('working')
  })

  it('auto-runs the queued message even after a failed turn', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'first' })
    await sendMessage(id, { text: 'queued' })
    mock.last?.onDone({ ok: false })
    await flushThread(id)
    expect(mock.starts).toBe(2)
    expect(mock.last?.text).toBe('queued')
    // The new turn cleared the failed flag as it started.
    expect((await listThreads('/repo'))[0]?.lastTurnFailed).toBeUndefined()
  })

  it('last write wins — a second mid-turn send replaces the queued message', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'first' })
    await sendMessage(id, { text: 'queued A' })
    await sendMessage(id, { text: 'queued B' })
    expect((await listThreads('/repo'))[0]?.queued).toEqual({ text: 'queued B' })
    mock.last?.onDone({ ok: true })
    await flushThread(id)
    expect(mock.last?.text).toBe('queued B')
  })

  it('cancelQueued drops the queued message so it does not auto-run', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'first' })
    await sendMessage(id, { text: 'queued' })
    await cancelQueued(id)
    expect((await listThreads('/repo'))[0]?.queued).toBeUndefined()
    expect((await readThread(id))?.queued).toBeUndefined()
    mock.last?.onDone({ ok: true })
    await flushThread(id)
    expect(mock.starts).toBe(1) // nothing drained
  })

  it('runs the queued message on abort ("stop this, do the next thing")', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'first' })
    await sendMessage(id, { text: 'queued' })
    await abortTurn(id)
    expect(mock.aborts).toBe(1)
    expect(mock.starts).toBe(2) // the queued message ran after the abort
    expect(mock.last?.text).toBe('queued')
    expect((await listThreads('/repo'))[0]?.status).toBe('working')
  })

  it('restores a queued message across a daemon restart (chip survives)', async () => {
    const { id } = await newThread()
    await sendMessage(id, { text: 'first' })
    await sendMessage(id, {
      text: 'queued',
      images: [{ mediaType: 'image/png', base64: 'BIG' }],
    })
    resetForTests() // simulate a daemon restart: reload from disk
    setDrivers(registry(mock))
    const restored = (await listThreads('/repo'))[0]
    expect(restored?.status).toBe('idle') // hydrated threads are idle
    expect(restored?.queued).toEqual({ text: 'queued', imageCount: 1 })
    // The full image payload is not on disk (never persisted).
    expect(JSON.stringify(await readThread(id))).not.toContain('BIG')
  })

  it('throttles roster broadcasts from streamed usage reports, keeping status flips instant', async () => {
    const events: AppEvent[] = []
    const unsub = subscribeAppEvents((e) => events.push(e))
    try {
      const { id } = await newThread()
      await sendMessage(id, { text: 'go' })
      const rosterBefore = events.filter((e) => e === 'agent-threads').length
      // A burst of usage reports coalesces onto a trailing timer — none broadcast synchronously.
      for (const n of [1, 2, 3]) {
        mock.last?.emit({
          t: 'status',
          status: 'working',
          usage: { inputTokens: n, outputTokens: n },
        })
      }
      expect(events.filter((e) => e === 'agent-threads').length).toBe(rosterBefore)
      // The idle flip on done is a status change, so it still broadcasts immediately.
      mock.last?.onDone({ ok: true })
      expect(events.filter((e) => e === 'agent-threads').length).toBeGreaterThan(rosterBefore)
    } finally {
      unsub()
    }
  })

  it('probes provider statuses, tolerating a throwing driver', async () => {
    const statuses = await providerStatuses()
    const byProvider = Object.fromEntries(statuses.map((s) => [s.provider, s]))
    expect(byProvider.claude).toMatchObject({ installed: true, authenticated: true })
    expect(byProvider.codex).toMatchObject({ installed: false, authenticated: false, models: [] })
  })
})
