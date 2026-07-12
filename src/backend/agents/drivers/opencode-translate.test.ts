import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '../../../shared/agent-protocol'
import { TOOL_OUTPUT_CAP } from '../../../shared/agent-protocol'
import {
  createOpencodeTranslator,
  drainSseLines,
  type OpencodeRawEvent,
  permissionResponseFor,
} from './opencode-translate'

// A stable id factory so error items are assertable.
function fixedIds(): () => string {
  let n = 0
  return () => `id-${++n}`
}

function raw(type: string, properties: Record<string, unknown>): OpencodeRawEvent {
  return { type, properties }
}

describe('drainSseLines', () => {
  it('parses data frames and buffers a partial trailing line', () => {
    const { events, rest } = drainSseLines(
      'data: {"id":"evt_1","type":"server.connected","properties":{}}\ndata: {"id":"evt_2","typ',
    )
    expect(events).toEqual([{ type: 'server.connected', properties: {} }])
    expect(rest).toBe('data: {"id":"evt_2","typ')
  })

  it('handles CRLF frames and ignores non-data / blank lines', () => {
    const { events } = drainSseLines(
      ': comment\r\ndata: {"type":"session.idle","properties":{"sessionID":"ses_1"}}\r\n\r\n',
    )
    expect(events).toEqual([{ type: 'session.idle', properties: { sessionID: 'ses_1' } }])
  })

  it('drops a malformed frame without throwing', () => {
    const { events } = drainSseLines(
      'data: {not json}\ndata: {"type":"session.idle","properties":{}}\n',
    )
    expect(events).toEqual([{ type: 'session.idle', properties: {} }])
  })

  it('drops a frame missing a string type', () => {
    const { events } = drainSseLines('data: {"properties":{}}\n')
    expect(events).toEqual([])
  })
})

describe('permissionResponseFor', () => {
  it('maps decisions to opencode reply verbs', () => {
    expect(permissionResponseFor('accept')).toBe('once')
    expect(permissionResponseFor('accept-session')).toBe('always')
    expect(permissionResponseFor('decline')).toBe('reject')
  })
})

describe('createOpencodeTranslator', () => {
  const SES = 'ses_1'
  const ASSISTANT = 'msg_assistant'
  const USER = 'msg_user'

  it('streams an assistant text part: item, deltas, then finalized on idle', () => {
    const t = createOpencodeTranslator('full', fixedIds())
    const events: AgentEvent[] = []
    const push = (r: OpencodeRawEvent) => events.push(...t.handle(r).events)

    push(raw('message.updated', { sessionID: SES, info: { id: ASSISTANT, role: 'assistant' } }))
    push(
      raw('message.part.updated', {
        sessionID: SES,
        part: { id: 'prt_1', type: 'text', text: '', messageID: ASSISTANT },
      }),
    )
    push(
      raw('message.part.delta', {
        sessionID: SES,
        messageID: ASSISTANT,
        partID: 'prt_1',
        field: 'text',
        delta: 'Hel',
      }),
    )
    push(
      raw('message.part.delta', {
        sessionID: SES,
        messageID: ASSISTANT,
        partID: 'prt_1',
        field: 'text',
        delta: 'lo',
      }),
    )
    const idle = t.handle(raw('session.idle', { sessionID: SES }))
    events.push(...idle.events)

    expect(events).toEqual([
      { t: 'item', item: { kind: 'assistant', id: 'prt_1', text: '', streaming: true } },
      { t: 'item-delta', id: 'prt_1', delta: 'Hel' },
      { t: 'item-delta', id: 'prt_1', delta: 'lo' },
      { t: 'item', item: { kind: 'assistant', id: 'prt_1', text: 'Hello', streaming: false } },
      { t: 'status', status: 'idle' },
    ])
    expect(idle.done).toEqual({ ok: true })
  })

  it('reconciles a cumulative part.updated after deltas', () => {
    const t = createOpencodeTranslator('full', fixedIds())
    t.handle(raw('message.updated', { sessionID: SES, info: { id: ASSISTANT, role: 'assistant' } }))
    t.handle(
      raw('message.part.updated', {
        sessionID: SES,
        part: { id: 'prt_1', type: 'text', text: '', messageID: ASSISTANT },
      }),
    )
    t.handle(
      raw('message.part.delta', { sessionID: SES, partID: 'prt_1', field: 'text', delta: 'Hi' }),
    )
    const reconciled = t.handle(
      raw('message.part.updated', {
        sessionID: SES,
        part: { id: 'prt_1', type: 'text', text: 'Hi there', messageID: ASSISTANT },
      }),
    )
    expect(reconciled.events).toEqual([
      { t: 'item', item: { kind: 'assistant', id: 'prt_1', text: 'Hi there', streaming: true } },
    ])
    // The finalized item carries the reconciled cumulative text.
    expect(t.finalize()).toEqual([
      { t: 'item', item: { kind: 'assistant', id: 'prt_1', text: 'Hi there', streaming: false } },
    ])
  })

  it('skips the echoed user prompt part', () => {
    const t = createOpencodeTranslator('full', fixedIds())
    const first = t.handle(
      raw('message.updated', { sessionID: SES, info: { id: USER, role: 'user' } }),
    )
    const echo = t.handle(
      raw('message.part.updated', {
        sessionID: SES,
        part: { id: 'prt_u', type: 'text', text: 'my prompt', messageID: USER },
      }),
    )
    expect(first.events).toEqual([])
    expect(echo.events).toEqual([])
  })

  it('maps a reasoning part to a reasoning item', () => {
    const t = createOpencodeTranslator('full', fixedIds())
    t.handle(raw('message.updated', { sessionID: SES, info: { id: ASSISTANT, role: 'assistant' } }))
    const out = t.handle(
      raw('message.part.updated', {
        sessionID: SES,
        part: { id: 'prt_r', type: 'reasoning', text: 'thinking', messageID: ASSISTANT },
      }),
    )
    expect(out.events).toEqual([
      { t: 'item', item: { kind: 'reasoning', id: 'prt_r', text: 'thinking', streaming: true } },
    ])
  })

  it('maps a tool part running -> ok with command detail and capped output', () => {
    const t = createOpencodeTranslator('full', fixedIds())
    const running = t.handle(
      raw('message.part.updated', {
        sessionID: SES,
        part: {
          id: 'prt_t',
          type: 'tool',
          tool: 'bash',
          callID: 'call_1',
          state: { status: 'running', input: { command: 'ls' } },
        },
      }),
    )
    expect(running.events).toEqual([
      {
        t: 'item',
        item: { kind: 'tool', id: 'prt_t', title: 'bash', status: 'running', detail: 'ls' },
      },
    ])

    const bigOutput = 'x'.repeat(TOOL_OUTPUT_CAP + 500)
    const done = t.handle(
      raw('message.part.updated', {
        sessionID: SES,
        part: {
          id: 'prt_t',
          type: 'tool',
          tool: 'bash',
          callID: 'call_1',
          state: { status: 'completed', input: { command: 'ls' }, output: bigOutput },
        },
      }),
    )
    const toolItem = done.events[0]
    expect(toolItem.t).toBe('item')
    if (toolItem.t === 'item' && toolItem.item.kind === 'tool') {
      expect(toolItem.item.status).toBe('ok')
      expect(toolItem.item.output?.length).toBe(TOOL_OUTPUT_CAP)
    }
  })

  it('renders a todowrite tool part as one upserted plan item', () => {
    const t = createOpencodeTranslator('full', fixedIds())
    const out = t.handle(
      raw('message.part.updated', {
        sessionID: SES,
        part: {
          id: 'prt_todo',
          type: 'tool',
          tool: 'todowrite',
          callID: 'call_todo',
          state: {
            status: 'completed',
            input: {
              todos: [
                { content: 'Explore the repo', status: 'completed' },
                { content: 'Implement the change', status: 'in_progress' },
                { content: 'Run the tests', status: 'pending' },
              ],
            },
          },
        },
      }),
    )
    expect(out.events).toEqual([
      {
        t: 'item',
        item: {
          kind: 'plan',
          id: 'plan',
          steps: [
            { text: 'Explore the repo', status: 'done' },
            { text: 'Implement the change', status: 'active' },
            { text: 'Run the tests', status: 'pending' },
          ],
        },
      },
    ])
  })

  it('skips a todowrite tool with no recoverable todo list (no stray item)', () => {
    const t = createOpencodeTranslator('full', fixedIds())
    const out = t.handle(
      raw('message.part.updated', {
        sessionID: SES,
        part: { id: 'prt_todo2', type: 'tool', tool: 'todowrite', state: { status: 'running' } },
      }),
    )
    expect(out.events).toEqual([])
  })

  it('maps a failed tool to an error status with the error message', () => {
    const t = createOpencodeTranslator('full', fixedIds())
    const out = t.handle(
      raw('message.part.updated', {
        sessionID: SES,
        part: {
          id: 'prt_e',
          type: 'tool',
          tool: 'edit',
          state: { status: 'error', error: 'permission denied' },
        },
      }),
    )
    expect(out.events).toEqual([
      {
        t: 'item',
        item: {
          kind: 'tool',
          id: 'prt_e',
          title: 'edit',
          status: 'error',
          output: 'permission denied',
        },
      },
    ])
  })

  it('approve mode: permission.asked emits a pending approval, resolveApproval accepts it', () => {
    const t = createOpencodeTranslator('approve', fixedIds())
    const asked = t.handle(
      raw('permission.asked', {
        id: 'per_1',
        sessionID: SES,
        permission: { type: 'bash' },
        metadata: { command: 'rm -rf build' },
      }),
    )
    expect(asked.autoApprovePermissionId).toBeUndefined()
    expect(asked.events).toEqual([
      {
        t: 'item',
        item: {
          kind: 'approval',
          id: 'per_1',
          requestId: 'per_1',
          title: 'bash',
          status: 'pending',
          command: 'rm -rf build',
        },
      },
    ])

    expect(t.resolveApproval('per_1', 'accept-session')).toEqual([
      {
        t: 'item',
        item: {
          kind: 'approval',
          id: 'per_1',
          requestId: 'per_1',
          title: 'bash',
          status: 'accepted',
          command: 'rm -rf build',
        },
      },
    ])
  })

  it('approve mode: decline resolves to a declined approval', () => {
    const t = createOpencodeTranslator('approve', fixedIds())
    t.handle(raw('permission.asked', { id: 'per_2', sessionID: SES, permission: 'Run command' }))
    expect(t.resolveApproval('per_2', 'decline')).toEqual([
      {
        t: 'item',
        item: {
          kind: 'approval',
          id: 'per_2',
          requestId: 'per_2',
          title: 'Run command',
          status: 'declined',
        },
      },
    ])
  })

  it('full mode: any permission.asked auto-approves with no timeline item', () => {
    const t = createOpencodeTranslator('full', fixedIds())
    const out = t.handle(
      raw('permission.asked', { id: 'per_x', sessionID: SES, permission: { type: 'bash' } }),
    )
    expect(out.events).toEqual([])
    expect(out.autoApprovePermissionId).toBe('per_x')
  })

  it('auto-edits mode: auto-approves edit/write-shaped asks only', () => {
    for (const type of ['edit', 'write', 'patch', 'multiedit']) {
      const t = createOpencodeTranslator('auto-edits', fixedIds())
      const out = t.handle(
        raw('permission.asked', { id: 'per_e', sessionID: SES, permission: { type } }),
      )
      expect(out.events).toEqual([])
      expect(out.autoApprovePermissionId).toBe('per_e')
    }
  })

  it('auto-edits mode: a non-edit ask (bash) surfaces a pending approval like approve mode', () => {
    const t = createOpencodeTranslator('auto-edits', fixedIds())
    const out = t.handle(
      raw('permission.asked', {
        id: 'per_b',
        sessionID: SES,
        permission: { type: 'bash' },
        metadata: { command: 'rm -rf build' },
      }),
    )
    expect(out.autoApprovePermissionId).toBeUndefined()
    expect(out.events).toEqual([
      {
        t: 'item',
        item: {
          kind: 'approval',
          id: 'per_b',
          requestId: 'per_b',
          title: 'bash',
          status: 'pending',
          command: 'rm -rf build',
        },
      },
    ])
    // And the human's answer resolves it, proving it was registered as a real approval.
    expect(t.resolveApproval('per_b', 'accept')).toEqual([
      {
        t: 'item',
        item: {
          kind: 'approval',
          id: 'per_b',
          requestId: 'per_b',
          title: 'bash',
          status: 'accepted',
          command: 'rm -rf build',
        },
      },
    ])
  })

  it('auto-edits mode: an ask with no usable type discriminator surfaces a prompt (safe default)', () => {
    const t = createOpencodeTranslator('auto-edits', fixedIds())
    const out = t.handle(
      raw('permission.asked', { id: 'per_u', sessionID: SES, permission: 'Do a thing' }),
    )
    expect(out.autoApprovePermissionId).toBeUndefined()
    expect(out.events[0]?.t).toBe('item')
  })

  it('session.error emits an error item and ends the turn', () => {
    const t = createOpencodeTranslator('full', fixedIds())
    const out = t.handle(
      raw('session.error', { sessionID: SES, error: { data: { message: 'rate limited' } } }),
    )
    expect(out.done).toEqual({ ok: false })
    expect(out.events).toEqual([
      { t: 'item', item: { kind: 'error', id: 'id-1', message: 'rate limited' } },
    ])
  })

  it('finalizes open streaming items before an error item', () => {
    const t = createOpencodeTranslator('full', fixedIds())
    t.handle(raw('message.updated', { sessionID: SES, info: { id: ASSISTANT, role: 'assistant' } }))
    t.handle(
      raw('message.part.updated', {
        sessionID: SES,
        part: { id: 'prt_1', type: 'text', text: 'partial', messageID: ASSISTANT },
      }),
    )
    const out = t.handle(raw('session.error', { sessionID: SES, error: 'boom' }))
    expect(out.events).toEqual([
      { t: 'item', item: { kind: 'assistant', id: 'prt_1', text: 'partial', streaming: false } },
      { t: 'item', item: { kind: 'error', id: 'id-1', message: 'boom' } },
    ])
  })

  it('ignores unknown event types and malformed parts', () => {
    const t = createOpencodeTranslator('full', fixedIds())
    expect(t.handle(raw('plugin.added', { id: 'x' })).events).toEqual([])
    expect(t.handle(raw('message.part.updated', { sessionID: SES, part: null })).events).toEqual([])
    expect(t.handle({ type: 'session.status' }).events).toEqual([])
  })
})

describe('createOpencodeTranslator session cost', () => {
  const SES = 'ses_1'

  it('emits summed cost + tokens as a status usage report across assistant messages', () => {
    const t = createOpencodeTranslator('full', fixedIds())
    const first = t.handle(
      raw('message.updated', {
        sessionID: SES,
        info: { id: 'm1', role: 'assistant', cost: 0.1, tokens: { input: 100, output: 20 } },
      }),
    )
    expect(first.events).toEqual([
      {
        t: 'status',
        status: 'working',
        usage: { inputTokens: 100, outputTokens: 20, costUsd: 0.1 },
      },
    ])
    // A second assistant message SUMS; a re-update of m1 would REPLACE (keyed by id).
    const second = t.handle(
      raw('message.updated', {
        sessionID: SES,
        info: { id: 'm2', role: 'assistant', cost: 0.05, tokens: { input: 10, output: 4 } },
      }),
    )
    expect(second.events).toEqual([
      {
        t: 'status',
        status: 'working',
        usage: { inputTokens: 110, outputTokens: 24, costUsd: 0.15000000000000002 },
      },
    ])
  })

  it('emits no usage for a legacy assistant message without cost/tokens or for the user', () => {
    const t = createOpencodeTranslator('full', fixedIds())
    expect(
      t.handle(raw('message.updated', { sessionID: SES, info: { id: 'm1', role: 'assistant' } }))
        .events,
    ).toEqual([])
    expect(
      t.handle(
        raw('message.updated', {
          sessionID: SES,
          info: { id: 'u1', role: 'user', cost: 0.9, tokens: { input: 5, output: 5 } },
        }),
      ).events,
    ).toEqual([])
  })
})
