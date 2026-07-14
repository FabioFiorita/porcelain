import { describe, expect, it } from 'vitest'
import type { TimelineItem } from '../../../shared/agent-protocol'
import {
  capItems,
  claudeProjectSlug,
  grokSessionDirName,
  previewText,
  resumeKey,
  textFromContent,
} from '../session-import'
import { mapClaudeTranscript } from './claude-sessions'
import { mapCodexRollout } from './codex-sessions'
import { mapGrokChatHistory } from './grok-sessions'
import { mapOpencodeMessages } from './opencode-sessions'

describe('session-import helpers', () => {
  it('slugs Claude project paths', () => {
    expect(claudeProjectSlug('/Users/fabio/Code/porcelain')).toBe('-Users-fabio-Code-porcelain')
  })

  it('encodes Grok session dirs', () => {
    expect(grokSessionDirName('/Users/fabio/Code/porcelain')).toBe(
      encodeURIComponent('/Users/fabio/Code/porcelain'),
    )
  })

  it('extracts text from content blocks', () => {
    expect(textFromContent('hi')).toBe('hi')
    expect(
      textFromContent([
        { type: 'text', text: 'a' },
        { type: 'text', text: 'b' },
      ]),
    ).toBe('ab')
    expect(textFromContent([{ type: 'input_text', text: 'x' }])).toBe('x')
  })

  it('caps items from the tail', () => {
    const items: TimelineItem[] = Array.from({ length: 5 }, (_, i) => ({
      kind: 'user',
      id: String(i),
      text: `m${i}`,
    }))
    // IMPORT_ITEM_CAP is 200 — with 5 items, no change
    expect(capItems(items)).toHaveLength(5)
  })

  it('resumeKey reads string and sessionId object', () => {
    expect(resumeKey('ses_1')).toBe('ses_1')
    expect(resumeKey({ sessionId: 'abc' })).toBe('abc')
    expect(resumeKey(null)).toBeNull()
  })

  it('previewText collapses whitespace', () => {
    expect(previewText('  hello\nworld  ', 20)).toBe('hello world')
  })
})

describe('mapGrokChatHistory', () => {
  it('maps user/assistant/tool round-trips', () => {
    const jsonl = [
      JSON.stringify({ type: 'system', content: 'ignore me' }),
      JSON.stringify({ type: 'user', content: 'fix the scroll' }),
      JSON.stringify({ type: 'reasoning', summary: [{ type: 'summary_text', text: 'thinking' }] }),
      JSON.stringify({
        type: 'assistant',
        content: 'ok',
        tool_calls: [{ id: 'c1', name: 'read_file', arguments: '{"path":"a.ts"}' }],
      }),
      JSON.stringify({ type: 'tool_result', tool_call_id: 'c1', content: 'file body' }),
      JSON.stringify({ type: 'assistant', content: 'done' }),
    ].join('\n')
    const items = mapGrokChatHistory(jsonl)
    expect(items.map((i) => i.kind)).toEqual([
      'user',
      'reasoning',
      'assistant',
      'tool',
      'assistant',
    ])
    const tool = items.find((i) => i.kind === 'tool')
    expect(tool).toMatchObject({
      kind: 'tool',
      title: 'read_file',
      status: 'ok',
      output: 'file body',
    })
  })
})

describe('mapClaudeTranscript', () => {
  it('maps user text and assistant tool_use', () => {
    const jsonl = [
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: [{ type: 'text', text: 'say hi' }] },
        cwd: '/repo',
      }),
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          model: 'claude-sonnet-5',
          content: [
            { type: 'text', text: 'hi' },
            { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } },
          ],
        },
      }),
      JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 't1', content: 'a.ts' }],
        },
      }),
    ].join('\n')
    const items = mapClaudeTranscript(jsonl)
    expect(items.map((i) => i.kind)).toEqual(['user', 'assistant', 'tool'])
    expect(items[2]).toMatchObject({ kind: 'tool', title: 'Bash', status: 'ok', output: 'a.ts' })
  })
})

describe('mapCodexRollout', () => {
  it('maps user/assistant messages and function calls', () => {
    const jsonl = [
      JSON.stringify({ type: 'session_meta', payload: { session_id: 's1', cwd: '/r' } }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'ping' }],
        },
      }),
      JSON.stringify({
        type: 'response_item',
        payload: { type: 'function_call', call_id: 'f1', name: 'shell', arguments: 'ls' },
      }),
      JSON.stringify({
        type: 'response_item',
        payload: { type: 'function_call_output', call_id: 'f1', output: 'ok' },
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'pong' }],
        },
      }),
    ].join('\n')
    const items = mapCodexRollout(jsonl)
    expect(items.map((i) => i.kind)).toEqual(['user', 'tool', 'assistant'])
    expect(items[1]).toMatchObject({ kind: 'tool', title: 'shell', status: 'ok', output: 'ok' })
  })
})

describe('mapOpencodeMessages', () => {
  it('maps user text and assistant tools', () => {
    const messages = [
      { id: 'm1', data: JSON.stringify({ role: 'user' }) },
      { id: 'm2', data: JSON.stringify({ role: 'assistant', modelID: 'x' }) },
    ]
    const parts = new Map<string, Array<Record<string, unknown>>>([
      ['m1', [{ type: 'text', text: 'hello board' }]],
      [
        'm2',
        [
          { type: 'reasoning', text: 'hmm' },
          {
            type: 'tool',
            tool: 'list_cards',
            callID: 'c1',
            state: { status: 'completed', output: '[]' },
          },
          { type: 'text', text: 'done' },
        ],
      ],
    ])
    const items = mapOpencodeMessages(messages, parts)
    expect(items.map((i) => i.kind)).toEqual(['user', 'reasoning', 'tool', 'assistant'])
    expect(items[2]).toMatchObject({ kind: 'tool', title: 'list_cards', status: 'ok' })
  })
})
