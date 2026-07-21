import type { TimelineItem } from '@shared/agent-protocol'
import { describe, expect, it } from 'vitest'
import { buildAgentTimeline } from './agent-timeline'

const user = (id: string, text = 'hi'): TimelineItem => ({ kind: 'user', id, text })
const assistant = (id: string, text = 'ok', streaming = false): TimelineItem => ({
  kind: 'assistant',
  id,
  text,
  streaming,
})
const tool = (id: string, title: string, detail?: string): TimelineItem => ({
  kind: 'tool',
  id,
  title,
  detail,
  status: 'ok',
})

describe('buildAgentTimeline', () => {
  it('folds tools under a turn-fold when idle, keeps the terminal assistant', () => {
    const items: TimelineItem[] = [
      user('u1'),
      tool('t1', 'Read', 'a.ts'),
      tool('t2', 'Edit', 'a.ts'),
      assistant('a1', 'done'),
    ]
    const rows = buildAgentTimeline(items, { working: false, turnStartedAt: 1000, now: 4000 })
    expect(rows.map((r) => r.kind)).toEqual(['item', 'turn-fold', 'item', 'changed-files'])
    expect(rows[0]).toMatchObject({ kind: 'item', item: { id: 'u1' } })
    expect(rows[1]).toMatchObject({ kind: 'turn-fold', elapsedMs: 3000 })
    if (rows[1]?.kind === 'turn-fold') {
      expect(rows[1].items.map((i) => i.id)).toEqual(['t1', 't2'])
    }
    expect(rows[2]).toMatchObject({ kind: 'item', item: { id: 'a1' } })
    if (rows[3]?.kind === 'changed-files') {
      expect(rows[3].writePaths).toEqual(['a.ts'])
    }
  })

  it('does not fold the live working turn', () => {
    const items: TimelineItem[] = [user('u1'), tool('t1', 'Bash', 'ls'), assistant('a1', '…', true)]
    const rows = buildAgentTimeline(items, { working: true })
    expect(rows.map((r) => r.kind)).toEqual(['item', 'item', 'item'])
    expect(rows.every((r) => r.kind !== 'turn-fold')).toBe(true)
    expect(rows.every((r) => r.kind !== 'changed-files')).toBe(true) // streaming assistant
  })

  it('does not fold when there is no terminal assistant yet', () => {
    const items: TimelineItem[] = [user('u1'), tool('t1', 'Bash', 'ls')]
    const rows = buildAgentTimeline(items, { working: false })
    expect(rows.every((r) => r.kind !== 'turn-fold')).toBe(true)
    expect(rows.some((r) => r.kind === 'item' && r.item.id === 't1')).toBe(true)
  })

  it('folds prior turns while the latest is working', () => {
    const items: TimelineItem[] = [
      user('u1'),
      tool('t1', 'Edit', 'a.ts'),
      assistant('a1', 'first'),
      user('u2'),
      tool('t2', 'Bash', 'test'),
    ]
    const rows = buildAgentTimeline(items, { working: true })
    const kinds = rows.map((r) => r.kind)
    expect(kinds).toContain('turn-fold')
    // Latest turn tools stay expanded as items
    expect(rows.some((r) => r.kind === 'item' && r.item.id === 't2')).toBe(true)
  })

  it('keeps pending approvals and plans outside the fold', () => {
    const items: TimelineItem[] = [
      user('u1'),
      tool('t1', 'Bash', 'rm -rf /'),
      {
        kind: 'plan',
        id: 'plan',
        steps: [
          { text: 'A', status: 'done' },
          { text: 'B', status: 'pending' },
          { text: 'C', status: 'pending' },
        ],
      },
      {
        kind: 'approval',
        id: 'ap1',
        requestId: 'r1',
        title: 'Run command',
        command: 'rm -rf /',
        status: 'pending',
      },
      assistant('a1', 'waiting'),
    ]
    const rows = buildAgentTimeline(items, { working: false })
    expect(rows.map((r) => r.kind)).toEqual(['item', 'turn-fold', 'item', 'item', 'item'])
    expect(rows[2]).toMatchObject({ kind: 'item', item: { kind: 'plan', id: 'plan' } })
    expect(rows[3]).toMatchObject({ kind: 'item', item: { kind: 'approval', id: 'ap1' } })
  })

  it('omits changed-files when the turn only read files', () => {
    const items: TimelineItem[] = [
      user('u1'),
      tool('t1', 'Read', 'a.ts'),
      assistant('a1', 'looked'),
    ]
    const rows = buildAgentTimeline(items, { working: false })
    expect(rows.every((r) => r.kind !== 'changed-files')).toBe(true)
  })
})
