import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentEvent } from '../../../shared/agent-protocol'
import type { StartTurnOptions } from '../types'
import { createFakeDriver } from './fake'

// Drive the scripted fake directly (not through the manager), collecting emits and onDone.
function harness(mode: StartTurnOptions['mode']) {
  const events: AgentEvent[] = []
  const done: { ok: boolean }[] = []
  const opts: StartTurnOptions = {
    repoPath: '/repo',
    model: 'fake-1',
    mode,
    interaction: 'build',
    options: {},
    resume: undefined,
    text: 'do a thing',
    images: [],
    emit: (event) => events.push(event),
    onSessionState: () => {},
    onDone: (result) => done.push(result),
  }
  const handle = createFakeDriver('claude').startTurn(opts)
  return { events, done, handle }
}

describe('fake driver', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('status advertises an installed, authenticated e2e account + model', async () => {
    const status = await createFakeDriver('codex').status()
    expect(status).toMatchObject({
      provider: 'codex',
      installed: true,
      authenticated: true,
      account: 'e2e',
    })
    expect(status.models[0]).toMatchObject({ id: 'fake-1', provider: 'codex' })
  })

  it('runs a full turn to completion in a non-approve mode', async () => {
    const { events, done } = harness('full')
    await vi.advanceTimersByTimeAsync(500)
    expect(done).toEqual([{ ok: true }])
    // The assistant text assembles, and the final status carries usage.
    const assistant = events.find((e) => e.t === 'item' && e.item.kind === 'assistant')
    expect(assistant).toBeDefined()
    const status = events.find((e) => e.t === 'status')
    expect(status).toEqual({
      t: 'status',
      status: 'idle',
      usage: { inputTokens: 100, outputTokens: 50 },
    })
    // No approval item in a non-approve turn.
    expect(events.some((e) => e.t === 'item' && e.item.kind === 'approval')).toBe(false)
  })

  it('gates on a pending approval in approve mode and finishes once answered', async () => {
    const { events, done, handle } = harness('approve')
    await vi.advanceTimersByTimeAsync(500)
    // The turn is blocked on a pending approval — not done yet.
    expect(done).toEqual([])
    const pending = events.find((e) => e.t === 'item' && e.item.kind === 'approval')
    expect(pending).toMatchObject({ item: { status: 'pending', requestId: 'fake-approval-1' } })

    handle.respondApproval('fake-approval-1', 'accept')
    await vi.advanceTimersByTimeAsync(100)
    expect(done).toEqual([{ ok: true }])
    const resolved = events.filter((e) => e.t === 'item' && e.item.kind === 'approval')
    expect(resolved.at(-1)).toMatchObject({ item: { status: 'accepted' } })
  })

  it('abort ends the turn once and cancels the remaining script', async () => {
    const { done, handle } = harness('full')
    await vi.advanceTimersByTimeAsync(50)
    handle.abort()
    handle.abort() // idempotent
    await vi.advanceTimersByTimeAsync(500)
    expect(done).toEqual([{ ok: false }])
  })
})
