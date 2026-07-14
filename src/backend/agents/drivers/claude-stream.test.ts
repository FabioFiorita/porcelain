import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '../../../shared/agent-protocol'
import {
  buildClaudeArgs,
  buildUserMessage,
  CLAUDE_MODELS,
  ClaudeStreamTranslator,
  mapClaudeUsage,
  parseClaudeOAuthToken,
  permissionModeForMode,
  planStepsFromTodos,
  readClaudeAuthFromJson,
  resolveClaudeBin,
  type StreamSignal,
  titleForTool,
} from './claude-stream'

// Feed a translator a batch of lines and collect every signal, in order.
function drive(lines: string[]): StreamSignal[] {
  const translator = new ClaudeStreamTranslator()
  return lines.flatMap((line) => translator.pushLine(line))
}

// Just the AgentEvents (the common assertion surface).
function events(signals: StreamSignal[]): AgentEvent[] {
  return signals
    .filter((s): s is Extract<StreamSignal, { t: 'event' }> => s.t === 'event')
    .map((s) => s.event)
}

const line = (obj: unknown): string => JSON.stringify(obj)

describe('resolveClaudeBin', () => {
  const home = '/Users/x'
  it('prefers PORCELAIN_CLAUDE_BIN when it exists', () => {
    const bin = resolveClaudeBin({
      env: { PORCELAIN_CLAUDE_BIN: '/custom/claude', PATH: '/usr/bin' },
      home,
      exists: (p) => p === '/custom/claude',
    })
    expect(bin).toBe('/custom/claude')
  })

  it('finds claude on PATH before the well-known locations', () => {
    const bin = resolveClaudeBin({
      env: { PATH: '/a:/b:/c' },
      home,
      exists: (p) => p === '/b/claude',
    })
    expect(bin).toBe('/b/claude')
  })

  it('falls back to ~/.local/bin/claude', () => {
    const bin = resolveClaudeBin({
      env: { PATH: '/nope' },
      home,
      exists: (p) => p === '/Users/x/.local/bin/claude',
    })
    expect(bin).toBe('/Users/x/.local/bin/claude')
  })

  it('returns null when nothing exists', () => {
    expect(resolveClaudeBin({ env: { PATH: '/nope' }, home, exists: () => false })).toBeNull()
  })
})

describe('readClaudeAuthFromJson', () => {
  it('reads the oauth email as the account', () => {
    const auth = readClaudeAuthFromJson(
      JSON.stringify({ oauthAccount: { emailAddress: 'a@b.com', accountUuid: 'u1' } }),
    )
    expect(auth).toEqual({ authenticated: true, account: 'a@b.com' })
  })

  it('is authenticated with only an account uuid (no email)', () => {
    const auth = readClaudeAuthFromJson(JSON.stringify({ oauthAccount: { accountUuid: 'u1' } }))
    expect(auth).toEqual({ authenticated: true })
  })

  it('tolerates a missing oauthAccount and malformed JSON', () => {
    expect(readClaudeAuthFromJson(JSON.stringify({ userID: 'x' }))).toEqual({
      authenticated: false,
    })
    expect(readClaudeAuthFromJson('not json')).toEqual({ authenticated: false })
  })
})

describe('titleForTool', () => {
  it('maps common tools to a title + salient detail', () => {
    expect(titleForTool('Bash', { command: 'ls -la' })).toEqual({ title: 'Bash', detail: 'ls -la' })
    expect(titleForTool('Edit', { file_path: '/a.ts' })).toEqual({ title: 'Edit', detail: '/a.ts' })
    expect(titleForTool('Read', { file_path: '/b.ts' })).toEqual({ title: 'Read', detail: '/b.ts' })
    expect(titleForTool('TodoWrite', {})).toEqual({ title: 'Update todos' })
  })

  it('falls through to the raw name for unknown/MCP tools', () => {
    expect(titleForTool('mcp__porcelain__list_cards', {})).toEqual({
      title: 'mcp__porcelain__list_cards',
    })
  })
})

describe('buildClaudeArgs', () => {
  it('includes --model when a model is given', () => {
    const args = buildClaudeArgs({ model: 'sonnet', mode: 'full' })
    expect(args).toContain('--model')
    expect(args[args.indexOf('--model') + 1]).toBe('sonnet')
    expect(args).toContain('--permission-mode')
    expect(args).not.toContain('--resume')
  })

  it('omits --model entirely for an empty model (the CLI default)', () => {
    const args = buildClaudeArgs({ model: '', mode: 'approve' })
    expect(args).not.toContain('--model')
    expect(args).not.toContain('') // never passes an empty arg
  })

  it('appends --resume with a session id', () => {
    const args = buildClaudeArgs({ model: 'claude-opus-4-8', mode: 'full', resumeId: 'sess-1' })
    expect(args.slice(-2)).toEqual(['--resume', 'sess-1'])
  })

  it('replaces the permission-mode with plan when interaction is plan', () => {
    // Plan supersedes the thread's permission posture while the toggle is on.
    const args = buildClaudeArgs({ model: 'claude-sonnet-5', mode: 'full', interaction: 'plan' })
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('plan')
  })

  it('keeps the mode-derived permission-mode for build interaction', () => {
    const args = buildClaudeArgs({ model: 'claude-sonnet-5', mode: 'full', interaction: 'build' })
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('bypassPermissions')
  })

  it('adds --effort when the model supports the chosen level', () => {
    const args = buildClaudeArgs({
      model: 'claude-sonnet-5',
      mode: 'full',
      options: { effort: 'xhigh' },
    })
    expect(args[args.indexOf('--effort') + 1]).toBe('xhigh')
  })

  it('drops an effort the chosen model does not advertise', () => {
    // Sonnet 4.6 tops out at max — xhigh is not in its set, so it must not be sent.
    const args = buildClaudeArgs({
      model: 'claude-sonnet-4-6',
      mode: 'full',
      options: { effort: 'xhigh' },
    })
    expect(args).not.toContain('--effort')
  })

  it('suffixes the model id with [1m] for a toggle-capable model asked for 1m', () => {
    const args = buildClaudeArgs({
      model: 'claude-sonnet-5',
      mode: 'full',
      options: { contextWindow: '1m' },
    })
    expect(args[args.indexOf('--model') + 1]).toBe('claude-sonnet-5[1m]')
  })

  it('ignores the 1m option for an always-1M model (no context toggle)', () => {
    const args = buildClaudeArgs({
      model: 'claude-opus-4-8',
      mode: 'full',
      options: { contextWindow: '1m' },
    })
    expect(args[args.indexOf('--model') + 1]).toBe('claude-opus-4-8')
  })
})

describe('CLAUDE_MODELS catalog', () => {
  it('includes Fable 5 with its slug and effort set', () => {
    const fable = CLAUDE_MODELS.find((m) => m.id === 'claude-fable-5')
    expect(fable).toMatchObject({ label: 'Claude Fable 5' })
    expect(fable?.efforts?.values).toContain('xhigh')
    expect(fable?.contextWindows?.default).toBe('200k')
  })

  it('gives Haiku no effort or context-window controls', () => {
    const haiku = CLAUDE_MODELS.find((m) => m.id === 'claude-haiku-4-5')
    expect(haiku?.efforts).toBeUndefined()
    expect(haiku?.contextWindows).toBeUndefined()
  })

  it('marks Opus 4.8 always-1M (no context toggle) but effort-capable', () => {
    const opus = CLAUDE_MODELS.find((m) => m.id === 'claude-opus-4-8')
    expect(opus?.contextWindows).toBeUndefined()
    expect(opus?.efforts?.default).toBe('high')
  })
})

describe('planStepsFromTodos', () => {
  it('maps todo statuses onto plan step statuses', () => {
    expect(
      planStepsFromTodos({
        todos: [
          { content: 'Read the code', status: 'completed', activeForm: 'Reading the code' },
          { content: 'Write the driver', status: 'in_progress', activeForm: 'Writing the driver' },
          { content: 'Add tests', status: 'pending', activeForm: 'Adding tests' },
        ],
      }),
    ).toEqual([
      { text: 'Read the code', status: 'done' },
      { text: 'Write the driver', status: 'active' },
      { text: 'Add tests', status: 'pending' },
    ])
  })

  it('returns null when there is no todo array', () => {
    expect(planStepsFromTodos({})).toBeNull()
  })
})

describe('permissionModeForMode', () => {
  it('maps the three postures onto CLI permission modes', () => {
    expect(permissionModeForMode('approve')).toBe('default')
    expect(permissionModeForMode('auto-edits')).toBe('acceptEdits')
    expect(permissionModeForMode('full')).toBe('bypassPermissions')
  })
})

describe('buildUserMessage', () => {
  it('builds a text-only user message', () => {
    const parsed = JSON.parse(buildUserMessage('hi', []))
    expect(parsed).toEqual({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: 'hi' }] },
    })
  })

  it('appends base64 image blocks in Anthropic shape', () => {
    const parsed = JSON.parse(
      buildUserMessage('look', [{ mediaType: 'image/png', base64: 'AAAA' }]),
    )
    expect(parsed.message.content[1]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'AAAA' },
    })
  })
})

describe('ClaudeStreamTranslator', () => {
  const initLine = (sessionId: string) =>
    line({
      type: 'system',
      subtype: 'init',
      session_id: sessionId,
      model: 'claude-haiku-4-5-20251001',
      capabilities: ['interrupt_receipt_v1', 'msg_lifecycle_v1'],
    })

  it('captures the session id, resolved model, and interrupt capability from init', () => {
    const translator = new ClaudeStreamTranslator()
    const signals = translator.pushLine(initLine('sess-1'))
    expect(signals).toEqual([
      { t: 'session', sessionId: 'sess-1' },
      { t: 'event', event: { t: 'meta', resolvedModel: 'claude-haiku-4-5-20251001' } },
    ])
    expect(translator.interruptSupported).toBe(true)
  })

  it('emits no model meta when init omits the model', () => {
    const translator = new ClaudeStreamTranslator()
    const signals = translator.pushLine(line({ type: 'system', subtype: 'init', session_id: 's' }))
    expect(signals).toEqual([{ t: 'session', sessionId: 's' }])
  })

  it('streams an assistant text block: open, deltas, final promotion', () => {
    const signals = drive([
      initLine('s'),
      line({ type: 'stream_event', event: { type: 'message_start', message: { id: 'msg_1' } } }),
      line({
        type: 'stream_event',
        event: { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
      }),
      line({
        type: 'stream_event',
        event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'He' } },
      }),
      line({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'llo' },
        },
      }),
      line({ type: 'stream_event', event: { type: 'content_block_stop', index: 0 } }),
    ])
    expect(events(signals)).toEqual([
      // The init line reports the resolved model as a meta event before the block events.
      { t: 'meta', resolvedModel: 'claude-haiku-4-5-20251001' },
      { t: 'item', item: { kind: 'assistant', id: 'msg_1:0', text: '', streaming: true } },
      { t: 'item-delta', id: 'msg_1:0', delta: 'He' },
      { t: 'item-delta', id: 'msg_1:0', delta: 'llo' },
      { t: 'item', item: { kind: 'assistant', id: 'msg_1:0', text: 'Hello', streaming: false } },
    ])
  })

  it('maps a thinking block to a reasoning item (opens on first delta, not empty)', () => {
    const signals = drive([
      initLine('s'),
      line({ type: 'stream_event', event: { type: 'message_start', message: { id: 'msg_2' } } }),
      line({
        type: 'stream_event',
        event: { type: 'content_block_start', index: 0, content_block: { type: 'thinking' } },
      }),
      line({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'thinking_delta', thinking: 'Hmm' },
        },
      }),
      line({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'thinking_delta', thinking: '…' },
        },
      }),
      line({ type: 'stream_event', event: { type: 'content_block_stop', index: 0 } }),
    ])
    expect(events(signals)).toEqual([
      { t: 'meta', resolvedModel: 'claude-haiku-4-5-20251001' },
      // First delta opens the item with text (no empty Thought row); later deltas append.
      { t: 'item', item: { kind: 'reasoning', id: 'msg_2:0', text: 'Hmm', streaming: true } },
      { t: 'item-delta', id: 'msg_2:0', delta: '…' },
      { t: 'item', item: { kind: 'reasoning', id: 'msg_2:0', text: 'Hmm…', streaming: false } },
    ])
  })

  it('suppresses redacted/empty thinking blocks (no Thought row)', () => {
    const signals = drive([
      line({ type: 'stream_event', event: { type: 'message_start', message: { id: 'msg_r' } } }),
      line({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'redacted_thinking' },
        },
      }),
      line({ type: 'stream_event', event: { type: 'content_block_stop', index: 0 } }),
    ])
    expect(events(signals)).toEqual([])
  })

  it('flows a tool_use through to its tool_result (running → ok, with output)', () => {
    const signals = drive([
      initLine('s'),
      line({ type: 'stream_event', event: { type: 'message_start', message: { id: 'm' } } }),
      line({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', id: 'toolu_9', name: 'Bash', input: {} },
        },
      }),
      line({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '{"command":"ls' },
        },
      }),
      line({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: ' -la"}' },
        },
      }),
      line({ type: 'stream_event', event: { type: 'content_block_stop', index: 0 } }),
      line({
        type: 'user',
        message: {
          content: [{ type: 'tool_result', tool_use_id: 'toolu_9', content: 'file-a\nfile-b' }],
        },
      }),
    ])
    expect(events(signals)).toEqual([
      { t: 'meta', resolvedModel: 'claude-haiku-4-5-20251001' },
      { t: 'item', item: { kind: 'tool', id: 'toolu_9', title: 'Bash', status: 'running' } },
      // Detail surfaces as soon as the streamed JSON has a complete "command" value —
      // once on the finishing delta, again on block close (idempotent upsert).
      {
        t: 'item',
        item: { kind: 'tool', id: 'toolu_9', title: 'Bash', detail: 'ls -la', status: 'running' },
      },
      {
        t: 'item',
        item: { kind: 'tool', id: 'toolu_9', title: 'Bash', detail: 'ls -la', status: 'running' },
      },
      {
        t: 'item',
        item: {
          kind: 'tool',
          id: 'toolu_9',
          title: 'Bash',
          detail: 'ls -la',
          status: 'ok',
          output: 'file-a\nfile-b',
        },
      },
    ])
  })

  it('flips a tool item to error on an is_error result, flattening block content', () => {
    const signals = drive([
      line({ type: 'stream_event', event: { type: 'message_start', message: { id: 'm' } } }),
      line({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'tool_use',
            id: 'toolu_e',
            name: 'Read',
            input: { file_path: '/x' },
          },
        },
      }),
      line({ type: 'stream_event', event: { type: 'content_block_stop', index: 0 } }),
      line({
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_e',
              is_error: true,
              content: [{ type: 'text', text: 'ENOENT' }],
            },
          ],
        },
      }),
    ])
    const last = events(signals).at(-1)
    expect(last).toEqual({
      t: 'item',
      item: {
        kind: 'tool',
        id: 'toolu_e',
        title: 'Read',
        detail: '/x',
        status: 'error',
        output: 'ENOENT',
      },
    })
  })

  it('renders a TodoWrite tool_use as one plan item, swallowing its tool_result', () => {
    const signals = drive([
      line({ type: 'stream_event', event: { type: 'message_start', message: { id: 'm' } } }),
      line({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', id: 'toolu_todo', name: 'TodoWrite', input: {} },
        },
      }),
      line({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'input_json_delta',
            partial_json:
              '{"todos":[{"content":"Wire it","status":"in_progress","activeForm":"Wiring it"},',
          },
        },
      }),
      line({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'input_json_delta',
            partial_json: '{"content":"Test it","status":"pending","activeForm":"Testing it"}]}',
          },
        },
      }),
      line({ type: 'stream_event', event: { type: 'content_block_stop', index: 0 } }),
      // The tool_result for the TodoWrite call must NOT produce a tool item.
      line({
        type: 'user',
        message: {
          content: [{ type: 'tool_result', tool_use_id: 'toolu_todo', content: 'Todos updated' }],
        },
      }),
    ])
    expect(events(signals)).toEqual([
      {
        t: 'item',
        item: {
          kind: 'plan',
          id: 'plan',
          steps: [
            { text: 'Wire it', status: 'active' },
            { text: 'Test it', status: 'pending' },
          ],
        },
      },
    ])
  })

  it('maps a can_use_tool control request to a pending approval + request signal', () => {
    const translator = new ClaudeStreamTranslator()
    const signals = translator.pushLine(
      line({
        type: 'control_request',
        request_id: 'req_7',
        request: {
          subtype: 'can_use_tool',
          tool_name: 'Bash',
          input: { command: 'rm -rf build' },
          permission_suggestions: [{ type: 'addRules' }],
        },
      }),
    )
    expect(events(signals)).toEqual([
      {
        t: 'item',
        item: {
          kind: 'approval',
          id: 'approval:req_7',
          requestId: 'req_7',
          title: 'Bash',
          command: 'rm -rf build',
          status: 'pending',
        },
      },
    ])
    expect(signals.find((s) => s.t === 'approval-request')).toEqual({
      t: 'approval-request',
      requestId: 'req_7',
      toolName: 'Bash',
      input: { command: 'rm -rf build' },
      permissionSuggestions: [{ type: 'addRules' }],
    })
  })

  it('emits an idle status with usage and a done signal on result/success', () => {
    const signals = drive([
      line({
        type: 'result',
        subtype: 'success',
        is_error: false,
        usage: { input_tokens: 10, output_tokens: 44 },
      }),
    ])
    expect(signals).toEqual([
      {
        t: 'event',
        event: { t: 'status', status: 'idle', usage: { inputTokens: 10, outputTokens: 44 } },
      },
      { t: 'done', ok: true },
    ])
  })

  it('surfaces total_cost_usd as the status usage costUsd', () => {
    const signals = drive([
      line({
        type: 'result',
        subtype: 'success',
        is_error: false,
        total_cost_usd: 0.4231,
        usage: { input_tokens: 10, output_tokens: 44 },
      }),
    ])
    expect(signals[0]).toEqual({
      t: 'event',
      event: {
        t: 'status',
        status: 'idle',
        usage: { inputTokens: 10, outputTokens: 44, costUsd: 0.4231 },
      },
    })
  })

  it('reports ok:false on an error result subtype', () => {
    const signals = drive([line({ type: 'result', subtype: 'error_max_turns', is_error: true })])
    expect(signals.at(-1)).toEqual({ t: 'done', ok: false })
  })

  it('tolerates blank and malformed lines, and unknown message types', () => {
    const translator = new ClaudeStreamTranslator()
    expect(translator.pushLine('')).toEqual([])
    expect(translator.pushLine('   ')).toEqual([])
    expect(translator.pushLine('{not json')).toEqual([])
    expect(translator.pushLine(line({ type: 'rate_limit_event', rate_limit_info: {} }))).toEqual([])
    expect(translator.pushLine(line({ type: 'system', subtype: 'status', status: null }))).toEqual(
      [],
    )
  })
})

describe('parseClaudeOAuthToken', () => {
  it('extracts the access token from a stored credential', () => {
    const raw = JSON.stringify({
      claudeAiOauth: { accessToken: 'sk-oauth-xyz', refreshToken: 'r', subscriptionType: 'max' },
    })
    expect(parseClaudeOAuthToken(raw)).toBe('sk-oauth-xyz')
  })

  it('returns null for an api-key credential, empty token, or malformed JSON', () => {
    expect(parseClaudeOAuthToken(JSON.stringify({ apiKey: 'x' }))).toBeNull()
    expect(parseClaudeOAuthToken(JSON.stringify({ claudeAiOauth: { accessToken: '' } }))).toBeNull()
    expect(parseClaudeOAuthToken('not json')).toBeNull()
  })
})

describe('mapClaudeUsage', () => {
  it('maps the known windows with epoch-seconds→ms resets', () => {
    const limits = mapClaudeUsage({
      five_hour: { used_percentage: 18, resets_at: 1_800_000_000 },
      seven_day: { used_percentage: 55, resets_at: 1_800_500_000 },
      seven_day_opus: { used_percentage: 70, resets_at: 1_800_500_000 },
      overageStatus: 'ok',
    })
    expect(limits).toEqual({
      windows: [
        { id: '5h', label: '5-hour', usedPercent: 18, resetsAt: 1_800_000_000_000 },
        { id: 'weekly', label: 'Weekly', usedPercent: 55, resetsAt: 1_800_500_000_000 },
        { id: 'weekly-opus', label: 'Weekly (Opus)', usedPercent: 70, resetsAt: 1_800_500_000_000 },
      ],
    })
  })

  it('keeps a window with no reset time and skips unparseable ones', () => {
    const limits = mapClaudeUsage({
      five_hour: { used_percentage: 5 },
      seven_day: { nope: true },
    })
    expect(limits).toEqual({ windows: [{ id: '5h', label: '5-hour', usedPercent: 5 }] })
  })

  it('returns null when no known window is present (api-key account)', () => {
    expect(mapClaudeUsage({ overageStatus: 'ok' })).toBeNull()
    expect(mapClaudeUsage('nope')).toBeNull()
  })
})
