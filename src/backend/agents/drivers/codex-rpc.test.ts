import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '../../../shared/agent-protocol'
import { TOOL_OUTPUT_CAP } from '../../../shared/agent-protocol'
import {
  buildApprovalItem,
  buildThreadResumeParams,
  buildThreadStartParams,
  buildTurnStartParams,
  buildUserInput,
  encodeMessage,
  isLegacyApprovalMethod,
  LineDecoder,
  modeToPolicy,
  parseAccountLabel,
  parseAuthenticated,
  parseIncoming,
  parseModelList,
  parseThreadId,
  parseTurnId,
  routingKeys,
  toLegacyDecision,
  toV2Decision,
  translateNotification,
} from './codex-rpc'

// A representative thread id from the live app-server (UUIDv7).
const THREAD = '019f530b-3d7b-7903-8b97-6af86bcbd640'
const TURN = '019f530b-3ed3-75d0-a8a4-c4f35ddd4932'

describe('framing', () => {
  it('encodes a request as a newline-terminated line with NO jsonrpc field', () => {
    const line = encodeMessage({ id: 1, method: 'initialize', params: {} })
    expect(line.endsWith('\n')).toBe(true)
    const parsed = JSON.parse(line)
    expect(parsed).toEqual({ id: 1, method: 'initialize', params: {} })
    expect('jsonrpc' in parsed).toBe(false)
  })

  it('reassembles lines across arbitrary chunk boundaries', () => {
    const decoder = new LineDecoder()
    expect(decoder.push('{"a":1}\n{"b":')).toEqual(['{"a":1}'])
    expect(decoder.push('2}\n')).toEqual(['{"b":2}'])
    expect(decoder.push('no newline yet')).toEqual([])
    expect(decoder.push('\n')).toEqual(['no newline yet'])
  })
})

describe('parseIncoming (request/response/notification correlation)', () => {
  it('classifies a response to our request (id, no method)', () => {
    expect(parseIncoming('{"id":3,"result":{"ok":true}}')).toEqual({
      kind: 'response',
      id: 3,
      result: { ok: true },
    })
  })

  it('classifies an error response', () => {
    const incoming = parseIncoming('{"id":3,"error":{"code":-1,"message":"boom"}}')
    expect(incoming).toEqual({ kind: 'response', id: 3, error: { code: -1, message: 'boom' } })
  })

  it('classifies a server→client request (id AND method) — the approval channel', () => {
    const line = `{"id":"srv-1","method":"item/commandExecution/requestApproval","params":{"threadId":"${THREAD}"}}`
    expect(parseIncoming(line)).toEqual({
      kind: 'request',
      id: 'srv-1',
      method: 'item/commandExecution/requestApproval',
      params: { threadId: THREAD },
    })
  })

  it('classifies a notification (method, no id)', () => {
    const incoming = parseIncoming('{"method":"turn/started","params":{"threadId":"t"}}')
    expect(incoming).toEqual({
      kind: 'notification',
      method: 'turn/started',
      params: { threadId: 't' },
    })
  })

  it('drops malformed lines instead of throwing', () => {
    expect(parseIncoming('not json')).toBeNull()
    expect(parseIncoming('')).toBeNull()
    expect(parseIncoming('{"neither":true}')).toBeNull()
    expect(parseIncoming('42')).toBeNull()
  })
})

describe('modeToPolicy', () => {
  it('maps the three postures onto approval policy + sandbox', () => {
    expect(modeToPolicy('approve')).toEqual({
      approvalPolicy: 'on-request',
      sandbox: 'workspace-write',
    })
    expect(modeToPolicy('auto-edits')).toEqual({
      approvalPolicy: 'never',
      sandbox: 'workspace-write',
    })
    expect(modeToPolicy('full')).toEqual({ approvalPolicy: 'never', sandbox: 'danger-full-access' })
  })
})

describe('thread param building', () => {
  it('includes model on thread/start when non-empty', () => {
    const params = buildThreadStartParams({
      cwd: '/repo',
      model: 'gpt-5-codex',
      approvalPolicy: 'never',
      sandbox: 'workspace-write',
    })
    expect(params).toEqual({
      cwd: '/repo',
      model: 'gpt-5-codex',
      approvalPolicy: 'never',
      sandbox: 'workspace-write',
    })
  })

  it('omits the model key entirely on thread/start when empty', () => {
    const params = buildThreadStartParams({
      cwd: '/repo',
      model: '',
      approvalPolicy: 'never',
      sandbox: 'workspace-write',
    })
    expect('model' in params).toBe(false)
    expect(params).toEqual({ cwd: '/repo', approvalPolicy: 'never', sandbox: 'workspace-write' })
  })

  it('omits the model key on thread/resume when empty, keeping excludeTurns', () => {
    const params = buildThreadResumeParams({
      threadId: THREAD,
      cwd: '/repo',
      model: '',
      approvalPolicy: 'on-request',
      sandbox: 'workspace-write',
    })
    expect('model' in params).toBe(false)
    expect(params).toEqual({
      threadId: THREAD,
      cwd: '/repo',
      approvalPolicy: 'on-request',
      sandbox: 'workspace-write',
      excludeTurns: true,
    })
  })
})

describe('buildTurnStartParams', () => {
  const input = buildUserInput('hi', [])

  it('includes effort on the turn when set', () => {
    expect(buildTurnStartParams({ threadId: THREAD, input, effort: 'xhigh' })).toEqual({
      threadId: THREAD,
      input,
      effort: 'xhigh',
    })
  })

  it('omits effort entirely when unset or empty (keeps the thread default)', () => {
    expect('effort' in buildTurnStartParams({ threadId: THREAD, input })).toBe(false)
    expect('effort' in buildTurnStartParams({ threadId: THREAD, input, effort: '' })).toBe(false)
  })

  it('sends a plan collaborationMode with built-in instructions when interaction is plan', () => {
    const params = buildTurnStartParams({
      threadId: THREAD,
      input,
      effort: 'high',
      model: 'gpt-5.6-sol',
      interaction: 'plan',
    })
    expect(params.collaborationMode).toEqual({
      mode: 'plan',
      settings: {
        model: 'gpt-5.6-sol',
        reasoning_effort: 'high',
        developer_instructions: null, // null = the mode's built-in instructions
      },
    })
    expect(params.effort).toBe('high')
  })

  it('omits collaborationMode for build interaction and for plan without a model', () => {
    const build = buildTurnStartParams({
      threadId: THREAD,
      input,
      model: 'gpt-5.6-sol',
      interaction: 'build',
    })
    expect('collaborationMode' in build).toBe(false)
    // settings.model is required by the schema — plan with no explicit model is skipped.
    const noModel = buildTurnStartParams({
      threadId: THREAD,
      input,
      model: '',
      interaction: 'plan',
    })
    expect('collaborationMode' in noModel).toBe(false)
  })
})

describe('buildUserInput', () => {
  it('builds a text element with no images', () => {
    expect(buildUserInput('hello', [])).toEqual([
      { type: 'text', text: 'hello', text_elements: [] },
    ])
  })

  it('appends images as data-URL image inputs (base64 survives a remote daemon)', () => {
    const input = buildUserInput('look', [{ mediaType: 'image/png', base64: 'AAAA' }])
    expect(input).toEqual([
      { type: 'text', text: 'look', text_elements: [] },
      { type: 'image', url: 'data:image/png;base64,AAAA' },
    ])
  })
})

describe('approval decision mapping', () => {
  it('maps to the v2 decision vocabulary', () => {
    expect(toV2Decision('accept')).toBe('accept')
    expect(toV2Decision('accept-session')).toBe('acceptForSession')
    expect(toV2Decision('decline')).toBe('decline')
  })

  it('maps to the legacy ReviewDecision vocabulary', () => {
    expect(toLegacyDecision('accept')).toBe('approved')
    expect(toLegacyDecision('accept-session')).toBe('approved_for_session')
    expect(toLegacyDecision('decline')).toBe('denied')
  })

  it('knows which methods speak the legacy vocabulary', () => {
    expect(isLegacyApprovalMethod('execCommandApproval')).toBe(true)
    expect(isLegacyApprovalMethod('applyPatchApproval')).toBe(true)
    expect(isLegacyApprovalMethod('item/commandExecution/requestApproval')).toBe(false)
  })
})

describe('model/auth/handshake parsing', () => {
  // Trimmed from a live `model/list` response.
  const modelList = {
    data: [
      {
        id: 'gpt-5.6-sol',
        model: 'gpt-5.6-sol',
        displayName: 'GPT-5.6-Sol',
        description: 'Latest frontier agentic coding model.',
        isDefault: true,
        supportedReasoningEfforts: [
          { reasoningEffort: 'low', description: '' },
          { reasoningEffort: 'medium', description: '' },
          { reasoningEffort: 'high', description: '' },
          { reasoningEffort: 'xhigh', description: '' },
        ],
        defaultReasoningEffort: 'high',
      },
      {
        id: 'gpt-5.5',
        model: 'gpt-5.5',
        displayName: 'GPT-5.5',
        description: 'Frontier model.',
        isDefault: false,
        supportedReasoningEfforts: [],
      },
    ],
    nextCursor: null,
  }

  it('parses the model catalog into ModelInfo rows, mapping efforts', () => {
    const parsed = parseModelList(modelList)
    expect(parsed).toEqual({
      models: [
        {
          id: 'gpt-5.6-sol',
          label: 'GPT-5.6-Sol',
          provider: 'codex',
          description: 'Latest frontier agentic coding model.',
          efforts: { values: ['low', 'medium', 'high', 'xhigh'], default: 'high' },
        },
        // Empty supportedReasoningEfforts → no efforts descriptor (control hidden).
        { id: 'gpt-5.5', label: 'GPT-5.5', provider: 'codex', description: 'Frontier model.' },
      ],
      nextCursor: null,
    })
  })

  it('returns null for a malformed model list', () => {
    expect(parseModelList({ nope: true })).toBeNull()
  })

  it('reads auth + account labels from live shapes', () => {
    expect(
      parseAuthenticated({ authMethod: 'chatgpt', authToken: null, requiresOpenaiAuth: true }),
    ).toBe(true)
    expect(parseAuthenticated({ authMethod: null })).toBe(false)
    expect(
      parseAccountLabel({
        account: { type: 'chatgpt', email: 'a@b.co', planType: 'plus' },
        requiresOpenaiAuth: true,
      }),
    ).toBe('a@b.co')
    expect(parseAccountLabel({ account: { type: 'chatgpt', email: null, planType: 'plus' } })).toBe(
      'plus',
    )
    expect(parseAccountLabel({ account: null })).toBeUndefined()
  })

  it('reads thread/turn ids from start responses', () => {
    expect(parseThreadId({ thread: { id: THREAD } })).toBe(THREAD)
    expect(parseThreadId({ nope: true })).toBeNull()
    expect(parseTurnId({ turn: { id: TURN } })).toBe(TURN)
    expect(parseTurnId({ nope: true })).toBeNull()
  })
})

describe('routingKeys', () => {
  it('reads ids from the flat item-event shape', () => {
    expect(routingKeys({ threadId: THREAD, turnId: TURN, itemId: 'x' })).toEqual({
      threadId: THREAD,
      turnId: TURN,
    })
  })

  it('reads ids from the nested lifecycle shape', () => {
    expect(routingKeys({ thread: { id: THREAD } })).toEqual({ threadId: THREAD, turnId: undefined })
    expect(routingKeys({ threadId: THREAD, turn: { id: TURN } })).toEqual({
      threadId: THREAD,
      turnId: TURN,
    })
  })

  it('yields empties for an unroutable payload', () => {
    expect(routingKeys(null)).toEqual({})
    expect(routingKeys(42)).toEqual({})
  })
})

// The item events are folded into a timeline by the shared reducer; here we assert the
// driver emits the right normalized events for realistic notification payloads.
function assistantItem(id: string, text: string, streaming: boolean): AgentEvent {
  return { t: 'item', item: { kind: 'assistant', id, text, streaming } }
}

describe('translateNotification', () => {
  it('opens a streaming assistant item on item/started(agentMessage)', () => {
    const params = {
      item: {
        type: 'agentMessage',
        id: 'msg_1',
        text: '',
        phase: 'final_answer',
        memoryCitation: null,
      },
      threadId: THREAD,
      turnId: TURN,
      startedAtMs: 1,
    }
    expect(translateNotification('item/started', params)).toEqual({
      events: [assistantItem('msg_1', '', true)],
    })
  })

  it('appends assistant deltas', () => {
    const params = { threadId: THREAD, turnId: TURN, itemId: 'msg_1', delta: 'pong' }
    expect(translateNotification('item/agentMessage/delta', params)).toEqual({
      events: [{ t: 'item-delta', id: 'msg_1', delta: 'pong' }],
    })
  })

  it('closes the assistant item (streaming:false) on item/completed', () => {
    const params = {
      item: {
        type: 'agentMessage',
        id: 'msg_1',
        text: 'pong',
        phase: 'final_answer',
        memoryCitation: null,
      },
      threadId: THREAD,
      turnId: TURN,
      completedAtMs: 2,
    }
    expect(translateNotification('item/completed', params)).toEqual({
      events: [assistantItem('msg_1', 'pong', false)],
    })
  })

  it('never echoes the user message item (the manager owns it)', () => {
    const params = {
      item: { type: 'userMessage', id: 'u1', clientId: null, content: [] },
      threadId: THREAD,
      turnId: TURN,
      startedAtMs: 1,
    }
    expect(translateNotification('item/started', params)).toEqual({ events: [] })
  })

  it('maps a command execution to a running then ok tool item', () => {
    const started = {
      item: {
        type: 'commandExecution',
        id: 'c1',
        command: 'ls -la',
        cwd: '/repo',
        status: 'inProgress',
      },
      threadId: THREAD,
      turnId: TURN,
      startedAtMs: 1,
    }
    expect(translateNotification('item/started', started)).toEqual({
      events: [
        {
          t: 'item',
          item: { kind: 'tool', id: 'c1', title: 'ls -la', detail: '/repo', status: 'running' },
        },
      ],
    })
    const completed = {
      item: {
        type: 'commandExecution',
        id: 'c1',
        command: 'ls -la',
        cwd: '/repo',
        status: 'completed',
        aggregatedOutput: 'README.md',
        exitCode: 0,
      },
      threadId: THREAD,
      turnId: TURN,
      completedAtMs: 2,
    }
    expect(translateNotification('item/completed', completed)).toEqual({
      events: [
        {
          t: 'item',
          item: {
            kind: 'tool',
            id: 'c1',
            title: 'ls -la',
            detail: '/repo',
            status: 'ok',
            output: 'README.md',
          },
        },
      ],
    })
  })

  it('marks a failed command as an error tool item', () => {
    const completed = {
      item: {
        type: 'commandExecution',
        id: 'c2',
        command: 'false',
        status: 'failed',
        aggregatedOutput: 'nope',
        exitCode: 1,
      },
      threadId: THREAD,
      turnId: TURN,
      completedAtMs: 2,
    }
    expect(translateNotification('item/completed', completed).events[0]).toMatchObject({
      t: 'item',
      item: { kind: 'tool', status: 'error', output: 'nope' },
    })
  })

  it('caps a runaway command output at TOOL_OUTPUT_CAP', () => {
    const huge = 'x'.repeat(TOOL_OUTPUT_CAP + 5000)
    const completed = {
      item: {
        type: 'commandExecution',
        id: 'c3',
        command: 'cat big',
        status: 'completed',
        aggregatedOutput: huge,
      },
      threadId: THREAD,
      turnId: TURN,
      completedAtMs: 2,
    }
    const event = translateNotification('item/completed', completed).events[0]
    expect(event).toMatchObject({ t: 'item' })
    if (event.t === 'item' && event.item.kind === 'tool') {
      expect(event.item.output?.length).toBeLessThan(huge.length)
      expect(event.item.output?.endsWith('…[truncated]')).toBe(true)
    }
  })

  it('maps a file change to a tool item with the diff as output', () => {
    const completed = {
      item: {
        type: 'fileChange',
        id: 'f1',
        changes: [{ path: 'a.ts', diff: '+line' }],
        status: 'completed',
      },
      threadId: THREAD,
      turnId: TURN,
      completedAtMs: 2,
    }
    expect(translateNotification('item/completed', completed)).toEqual({
      events: [
        {
          t: 'item',
          item: { kind: 'tool', id: 'f1', title: 'Edit a.ts', status: 'ok', output: '+line' },
        },
      ],
    })
  })

  it('carries token usage into a status event', () => {
    const params = {
      threadId: THREAD,
      turnId: TURN,
      tokenUsage: {
        total: { inputTokens: 100, outputTokens: 5 },
        last: { inputTokens: 100, outputTokens: 5 },
      },
    }
    expect(translateNotification('thread/tokenUsage/updated', params)).toEqual({
      events: [{ t: 'status', status: 'working', usage: { inputTokens: 100, outputTokens: 5 } }],
    })
  })

  it('maps turn/plan/updated onto one upserted plan item', () => {
    const params = {
      threadId: THREAD,
      turnId: TURN,
      explanation: null,
      plan: [
        { step: 'Investigate the bug', status: 'completed' },
        { step: 'Write the fix', status: 'inProgress' },
        { step: 'Add a regression test', status: 'pending' },
      ],
    }
    expect(translateNotification('turn/plan/updated', params)).toEqual({
      events: [
        {
          t: 'item',
          item: {
            kind: 'plan',
            id: 'plan',
            steps: [
              { text: 'Investigate the bug', status: 'done' },
              { text: 'Write the fix', status: 'active' },
              { text: 'Add a regression test', status: 'pending' },
            ],
          },
        },
      ],
    })
  })

  it('ends the turn ok on turn/completed', () => {
    const params = { threadId: THREAD, turn: { id: TURN, status: 'completed', error: null } }
    expect(translateNotification('turn/completed', params)).toEqual({
      events: [],
      done: { ok: true },
    })
  })

  it('ends the turn with an error item on a failed turn', () => {
    const params = {
      threadId: THREAD,
      turn: { id: TURN, status: 'failed', error: { message: 'rate limited' } },
    }
    const result = translateNotification('turn/completed', params)
    expect(result.done).toEqual({ ok: false })
    expect(result.events[0]).toMatchObject({
      t: 'item',
      item: { kind: 'error', message: 'rate limited' },
    })
  })

  it('surfaces a terminal error notification but ignores a retryable one', () => {
    const terminal = {
      error: { message: 'fatal' },
      willRetry: false,
      threadId: THREAD,
      turnId: TURN,
    }
    const result = translateNotification('error', terminal)
    expect(result.done).toEqual({ ok: false })
    expect(result.events[0]).toMatchObject({ t: 'item', item: { kind: 'error', message: 'fatal' } })
    const retryable = {
      error: { message: 'transient' },
      willRetry: true,
      threadId: THREAD,
      turnId: TURN,
    }
    expect(translateNotification('error', retryable)).toEqual({ events: [] })
  })

  it('drops unknown or malformed notifications without throwing', () => {
    expect(translateNotification('remoteControl/status/changed', { status: 'disabled' })).toEqual({
      events: [],
    })
    expect(translateNotification('item/started', { item: 42 })).toEqual({ events: [] })
    expect(translateNotification('item/agentMessage/delta', { garbage: true })).toEqual({
      events: [],
    })
    expect(translateNotification('thread/tokenUsage/updated', null)).toEqual({ events: [] })
  })
})

describe('approval request → item → response round trip', () => {
  it('builds a pending exec approval item carrying the command', () => {
    const event = buildApprovalItem('srv-7', 'item/commandExecution/requestApproval', {
      threadId: THREAD,
      turnId: TURN,
      command: 'rm -rf build',
      cwd: '/repo',
    })
    expect(event).toEqual({
      t: 'item',
      item: {
        kind: 'approval',
        id: 'srv-7',
        requestId: 'srv-7',
        title: 'Run: rm -rf build',
        command: 'rm -rf build',
        status: 'pending',
      },
    })
  })

  it('builds a pending file-change approval item', () => {
    const event = buildApprovalItem('srv-8', 'item/fileChange/requestApproval', {
      threadId: THREAD,
      turnId: TURN,
    })
    expect(event).toEqual({
      t: 'item',
      item: {
        kind: 'approval',
        id: 'srv-8',
        requestId: 'srv-8',
        title: 'Apply file changes',
        status: 'pending',
      },
    })
  })

  it('the decision maps back to the right response vocabulary for the request method', () => {
    // v2 request → v2 decision; the driver writes { id: serverReqId, result: { decision } }.
    expect(toV2Decision('accept-session')).toBe('acceptForSession')
    // legacy request → ReviewDecision.
    expect(toLegacyDecision('accept-session')).toBe('approved_for_session')
  })
})
