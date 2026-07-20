import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '../../../shared/agent-protocol'
import { PORCELAIN_PREAMBLE } from '../porcelain-preamble'
import {
  buildGrokArgs,
  buildGrokTextAndImages,
  GROK_MODELS,
  GrokStreamTranslator,
  mapGrokUsage,
  permissionModeForMode,
  readGrokAuth,
  resolveGrokBin,
  type StreamSignal,
} from './grok-stream'

function drive(lines: string[], turnKey = 'turn-1'): StreamSignal[] {
  const translator = new GrokStreamTranslator(turnKey)
  return lines.flatMap((line) => translator.pushLine(line))
}

function events(signals: StreamSignal[]): AgentEvent[] {
  return signals
    .filter((s): s is Extract<StreamSignal, { t: 'event' }> => s.t === 'event')
    .map((s) => s.event)
}

const line = (obj: unknown): string => JSON.stringify(obj)

describe('resolveGrokBin', () => {
  const home = '/Users/x'
  it('prefers PORCELAIN_GROK_BIN when it exists', () => {
    expect(
      resolveGrokBin({
        env: { PORCELAIN_GROK_BIN: '/custom/grok', PATH: '/usr/bin' },
        home,
        exists: (p) => p === '/custom/grok',
      }),
    ).toBe('/custom/grok')
  })

  it('finds grok on PATH before well-known locations', () => {
    expect(
      resolveGrokBin({
        env: { PATH: '/a:/b' },
        home,
        exists: (p) => p === '/b/grok',
      }),
    ).toBe('/b/grok')
  })

  it('falls back to ~/.grok/bin/grok', () => {
    expect(
      resolveGrokBin({
        env: { PATH: '/nope' },
        home,
        exists: (p) => p === '/Users/x/.grok/bin/grok',
      }),
    ).toBe('/Users/x/.grok/bin/grok')
  })

  it('returns null when nothing exists', () => {
    expect(resolveGrokBin({ env: { PATH: '/nope' }, home, exists: () => false })).toBeNull()
  })
})

describe('readGrokAuth', () => {
  it('treats XAI_API_KEY as authenticated', () => {
    expect(readGrokAuth({ authJson: null, env: { XAI_API_KEY: 'xai-test' } })).toEqual({
      authenticated: true,
      account: 'API key',
    })
  })

  it('treats a non-empty auth.json as signed in', () => {
    expect(
      readGrokAuth({
        authJson: JSON.stringify({ 'https://auth.x.ai::id': { key: 'tok' } }),
        env: {},
      }),
    ).toEqual({ authenticated: true, account: 'grok.com' })
  })

  it('is unauthenticated with empty/malformed input', () => {
    expect(readGrokAuth({ authJson: null, env: {} })).toEqual({ authenticated: false })
    expect(readGrokAuth({ authJson: '{}', env: {} })).toEqual({ authenticated: false })
    expect(readGrokAuth({ authJson: 'not-json', env: {} })).toEqual({ authenticated: false })
  })
})

describe('permissionModeForMode / buildGrokArgs', () => {
  it('maps the three postures', () => {
    expect(permissionModeForMode('approve')).toBe('default')
    expect(permissionModeForMode('auto-edits')).toBe('acceptEdits')
    expect(permissionModeForMode('full')).toBe('bypassPermissions')
  })

  it('builds a headless streaming-json argv', () => {
    const args = buildGrokArgs({
      prompt: 'fix it',
      model: 'grok-4.5',
      mode: 'full',
      options: { effort: 'high' },
    })
    expect(args).toEqual([
      '-p',
      'fix it',
      '--output-format',
      'streaming-json',
      '--rules',
      PORCELAIN_PREAMBLE,
      '--model',
      'grok-4.5',
      '--permission-mode',
      'bypassPermissions',
      '--reasoning-effort',
      'high',
      '--no-auto-update',
    ])
  })

  it('plan interaction replaces the permission mode', () => {
    const args = buildGrokArgs({
      prompt: 'design it',
      model: 'grok-4.5',
      mode: 'full',
      interaction: 'plan',
    })
    expect(args).toContain('--permission-mode')
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('plan')
  })

  it('resumes a prior session', () => {
    const args = buildGrokArgs({
      prompt: 'continue',
      model: '',
      mode: 'auto-edits',
      resumeId: 'sess-1',
    })
    expect(args).toContain('--resume')
    expect(args[args.indexOf('--resume') + 1]).toBe('sess-1')
    expect(args).not.toContain('--session-id')
  })

  it('pins a new session id on the first turn (so abort can still resume)', () => {
    const args = buildGrokArgs({
      prompt: 'first message',
      model: '',
      mode: 'full',
      newSessionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    })
    expect(args).toContain('--session-id')
    expect(args[args.indexOf('--session-id') + 1]).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(args).not.toContain('--resume')
  })

  it('prefers resume over newSessionId when both are set', () => {
    const args = buildGrokArgs({
      prompt: 'x',
      model: '',
      mode: 'full',
      resumeId: 'existing',
      newSessionId: 'should-not-appear',
    })
    expect(args).toContain('--resume')
    expect(args).not.toContain('--session-id')
  })

  it('drops an unsupported effort', () => {
    const args = buildGrokArgs({
      prompt: 'x',
      model: 'grok-4.5',
      mode: 'full',
      options: { effort: 'not-a-real-effort' },
    })
    expect(args).not.toContain('--reasoning-effort')
  })

  it('uses --prompt-json instead of -p when promptJson is set (images)', () => {
    const promptJson = JSON.stringify([
      { type: 'text', text: 'look' },
      { type: 'image', mimeType: 'image/png', data: 'AAAA' },
    ])
    const args = buildGrokArgs({
      prompt: 'look',
      promptJson,
      model: 'grok-4.5',
      mode: 'full',
    })
    expect(args[0]).toBe('--prompt-json')
    expect(args[1]).toBe(promptJson)
    expect(args).not.toContain('-p')
  })
})

describe('buildGrokTextAndImages', () => {
  it('always leads with a text block and appends ACP image blocks', () => {
    expect(
      buildGrokTextAndImages('see this', [
        { mediaType: 'image/png', base64: 'AAAA' },
        { mediaType: 'image/webp', base64: 'BBBB' },
      ]),
    ).toEqual([
      { type: 'text', text: 'see this' },
      { type: 'image', mimeType: 'image/png', data: 'AAAA' },
      { type: 'image', mimeType: 'image/webp', data: 'BBBB' },
    ])
  })
})

describe('GROK_MODELS', () => {
  it('is non-empty and every entry is grok', () => {
    expect(GROK_MODELS.length).toBeGreaterThan(0)
    for (const m of GROK_MODELS) expect(m.provider).toBe('grok')
  })
})

describe('GrokStreamTranslator', () => {
  it('streams text into one assistant item and finalizes on end', () => {
    const signals = drive([
      line({ type: 'text', data: 'Hello' }),
      line({ type: 'text', data: ' world' }),
      line({
        type: 'end',
        stopReason: 'EndTurn',
        sessionId: 's1',
        usage: { input_tokens: 10, output_tokens: 5 },
        modelUsage: { 'grok-4.5': { inputTokens: 10, outputTokens: 5 } },
      }),
    ])
    expect(events(signals)).toEqual([
      {
        t: 'item',
        item: { kind: 'assistant', id: 'grok-a:turn-1', text: 'Hello', streaming: true },
      },
      {
        t: 'item',
        item: {
          kind: 'assistant',
          id: 'grok-a:turn-1',
          text: 'Hello world',
          streaming: true,
        },
      },
      {
        t: 'item',
        item: {
          kind: 'assistant',
          id: 'grok-a:turn-1',
          text: 'Hello world',
          streaming: false,
        },
      },
      { t: 'status', status: 'idle', usage: { inputTokens: 10, outputTokens: 5 } },
      { t: 'meta', resolvedModel: 'grok-4.5' },
    ])
    expect(signals).toContainEqual({ t: 'session', sessionId: 's1' })
    expect(signals).toContainEqual({ t: 'done', ok: true })
  })

  it('streams thoughts as reasoning and closes them before text', () => {
    const signals = drive([
      line({ type: 'thought', data: 'hmm' }),
      line({ type: 'text', data: 'ok' }),
      line({ type: 'end', stopReason: 'EndTurn', sessionId: 's2' }),
    ])
    const kinds = events(signals).map((e) =>
      e.t === 'item' ? e.item.kind : e.t === 'status' ? 'status' : e.t,
    )
    expect(kinds[0]).toBe('reasoning')
    // reasoning closed (streaming:false) then assistant open
    expect(kinds).toContain('assistant')
    expect(signals.at(-1)).toEqual({ t: 'done', ok: true })
  })

  it('mints distinct assistant ids per turn so multi-turn replies do not overwrite', () => {
    const turn1 = drive([line({ type: 'text', data: 'first' })], 'a')
    const turn2 = drive([line({ type: 'text', data: 'second' })], 'b')
    const id1 = events(turn1)[0]
    const id2 = events(turn2)[0]
    expect(id1?.t === 'item' && id1.item.id).toBe('grok-a:a')
    expect(id2?.t === 'item' && id2.item.id).toBe('grok-a:b')
  })

  it('finalize closes a still-streaming assistant when the process exits without end', () => {
    const translator = new GrokStreamTranslator('exit')
    translator.pushLine(line({ type: 'text', data: 'partial' }))
    const closed = translator.finalize()
    expect(events(closed)).toEqual([
      {
        t: 'item',
        item: { kind: 'assistant', id: 'grok-a:exit', text: 'partial', streaming: false },
      },
    ])
    // Idempotent — a second finalize emits nothing.
    expect(translator.finalize()).toEqual([])
  })

  it('emits an error item and done ok=false on error events', () => {
    const signals = drive([line({ type: 'error', message: 'auth failed' })])
    expect(events(signals)).toEqual([
      { t: 'item', item: { kind: 'error', id: 'grok-e:turn-1', message: 'auth failed' } },
    ])
    expect(signals).toContainEqual({ t: 'done', ok: false })
  })

  it('ignores malformed and unknown lines', () => {
    expect(drive(['not-json', line({ type: 'max_turns_reached' }), ''])).toEqual([])
  })
})

describe('mapGrokUsage', () => {
  it('maps snake_case token fields', () => {
    expect(
      mapGrokUsage({
        input_tokens: 1,
        output_tokens: 2,
        total_cost_usd: 0.01,
      }),
    ).toEqual({ inputTokens: 1, outputTokens: 2, costUsd: 0.01 })
  })

  it('returns null for empty/invalid', () => {
    expect(mapGrokUsage(null)).toBeNull()
    expect(mapGrokUsage({})).toBeNull()
  })
})
