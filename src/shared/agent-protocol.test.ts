import { describe, expect, it } from 'vitest'
import { type AgentEvent, applyAgentEvent, type TimelineItem } from './agent-protocol'

const user = (id: string, text: string): TimelineItem => ({ kind: 'user', id, text })
const assistant = (id: string, text: string, streaming: boolean): TimelineItem => ({
  kind: 'assistant',
  id,
  text,
  streaming,
})

describe('applyAgentEvent', () => {
  it('appends an item whose id is new', () => {
    const before: TimelineItem[] = [user('u1', 'hi')]
    const after = applyAgentEvent(before, { t: 'item', item: assistant('a1', 'hello', true) })
    expect(after.map((i) => i.id)).toEqual(['u1', 'a1'])
  })

  it('upserts an item with an existing id in place (idempotent promote)', () => {
    const before: TimelineItem[] = [assistant('a1', 'partial', true)]
    const after = applyAgentEvent(before, { t: 'item', item: assistant('a1', 'final', false) })
    expect(after).toHaveLength(1)
    expect(after[0]).toEqual(assistant('a1', 'final', false))
  })

  it('flips a tool item running→ok by re-emitting the same id', () => {
    const running: TimelineItem = { kind: 'tool', id: 't1', title: 'ls', status: 'running' }
    const done: TimelineItem = { kind: 'tool', id: 't1', title: 'ls', status: 'ok', output: 'a\nb' }
    const after = applyAgentEvent([running], { t: 'item', item: done })
    expect(after).toEqual([done])
  })

  it('appends a delta onto an assistant item and keeps it streaming', () => {
    const before: TimelineItem[] = [assistant('a1', 'Hel', true)]
    const after = applyAgentEvent(before, { t: 'item-delta', id: 'a1', delta: 'lo' })
    expect(after[0]).toEqual(assistant('a1', 'Hello', true))
  })

  it('marks a non-streaming assistant item streaming again on a delta', () => {
    const before: TimelineItem[] = [assistant('a1', 'Hel', false)]
    const after = applyAgentEvent(before, { t: 'item-delta', id: 'a1', delta: 'lo' })
    expect(after[0]).toEqual(assistant('a1', 'Hello', true))
  })

  it('upserts a plan item under its stable id (successive TodoWrites replace it)', () => {
    const first: TimelineItem = {
      kind: 'plan',
      id: 'plan',
      steps: [{ text: 'Write the tests', status: 'active' }],
    }
    const after = applyAgentEvent([user('u1', 'go')], { t: 'item', item: first })
    expect(after.map((i) => i.id)).toEqual(['u1', 'plan'])
    const second: TimelineItem = {
      kind: 'plan',
      id: 'plan',
      steps: [
        { text: 'Write the tests', status: 'done' },
        { text: 'Wire the driver', status: 'active' },
      ],
    }
    const next = applyAgentEvent(after, { t: 'item', item: second })
    expect(next).toHaveLength(2)
    expect(next[1]).toEqual(second)
  })

  it('upserts a user item carrying image thumbnails intact', () => {
    const withThumbs: TimelineItem = {
      kind: 'user',
      id: 'u1',
      text: 'look',
      imageCount: 1,
      thumbnails: [{ mediaType: 'image/jpeg', base64: 'THUMB' }],
    }
    const after = applyAgentEvent([], { t: 'item', item: withThumbs })
    expect(after).toEqual([withThumbs])
  })

  it('appends a delta onto a reasoning item', () => {
    const before: TimelineItem[] = [{ kind: 'reasoning', id: 'r1', text: 'think', streaming: true }]
    const after = applyAgentEvent(before, { t: 'item-delta', id: 'r1', delta: 'ing' })
    expect(after[0]).toEqual({ kind: 'reasoning', id: 'r1', text: 'thinking', streaming: true })
  })

  it('ignores a delta for an unknown id', () => {
    const before: TimelineItem[] = [assistant('a1', 'x', true)]
    const after = applyAgentEvent(before, { t: 'item-delta', id: 'missing', delta: '!' })
    expect(after).toEqual(before)
  })

  it('ignores a delta aimed at a non-text item (user/tool)', () => {
    const before: TimelineItem[] = [
      user('u1', 'hi'),
      { kind: 'tool', id: 't1', title: 'ls', status: 'running' },
    ]
    expect(applyAgentEvent(before, { t: 'item-delta', id: 'u1', delta: '!' })).toEqual(before)
    expect(applyAgentEvent(before, { t: 'item-delta', id: 't1', delta: '!' })).toEqual(before)
  })

  it('passes the list through untouched for status and meta events', () => {
    const before: TimelineItem[] = [user('u1', 'hi')]
    const events: AgentEvent[] = [
      { t: 'status', status: 'working' },
      { t: 'status', status: 'idle', usage: { inputTokens: 1, outputTokens: 2 } },
      { t: 'meta', title: 'renamed' },
      { t: 'meta', model: 'opus', provider: 'claude' },
    ]
    for (const event of events) expect(applyAgentEvent(before, event)).toBe(before)
  })

  it('never mutates the input array', () => {
    const before: TimelineItem[] = [assistant('a1', 'a', true)]
    const snapshot = structuredClone(before)
    applyAgentEvent(before, { t: 'item', item: assistant('a2', 'b', true) })
    applyAgentEvent(before, { t: 'item-delta', id: 'a1', delta: 'z' })
    expect(before).toEqual(snapshot)
  })
})
