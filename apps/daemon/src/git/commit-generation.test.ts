// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  agentCliPath,
  buildCommitGenerationPrompt,
  claudeEnvelopeError,
  cliFailure,
  jsonObjectCandidates,
  meaningfulOutput,
  parseGeneratedCommitGroups,
  parseGeneratedCommitMessage,
  parseOpenCodeCommitModels,
} from './commit-generation'

describe('commit generation', () => {
  it('prepends user install bins so GUI/systemd daemons still find claude/codex/grok', () => {
    const path = agentCliPath('/usr/bin:/bin', '/home/me')
    expect(path.startsWith('/home/me/.local/bin:')).toBe(true)
    expect(path).toContain('/home/me/.volta/bin')
    expect(path).toContain('/home/me/.grok/bin')
    expect(path.endsWith('/usr/bin:/bin')).toBe(true)
  })

  it('builds a prompt that keeps the model read-only and makes the effort explicit', () => {
    const prompt = buildCommitGenerationPrompt({
      mode: 'single',
      branch: 'feature/commit-copy',
      files: ['src/commit.ts'],
      summary: 'M\tsrc/commit.ts',
      patch: '+const message = generate()\n',
    })

    expect(prompt).toContain('Do not edit files, run commands, or make a commit')
    expect(prompt).toContain('Branch: feature/commit-copy')
    expect(prompt).toContain('src/commit.ts')
    expect(prompt).toContain('Return only JSON')
  })

  it('normalizes a fenced single-message response', () => {
    expect(
      parseGeneratedCommitMessage('```json\n{"subject":"Add generated copy.","body":""}\n```'),
    ).toBe('Add generated copy')
  })

  it('keeps only the curated OpenCode models from the configured inventory', () => {
    const models = parseOpenCodeCommitModels(
      ['zhipuai/glm-5.2', 'moonshot/kimi-k2.7', 'moonshot/kimi-v3', 'openai/gpt-5.2'].join('\n'),
    )

    expect(models).toEqual([
      { id: 'opencode:zhipuai/glm-5.2', label: 'GLM 5.2 (zhipuai)', provider: 'opencode' },
      { id: 'opencode:moonshot/kimi-k2.7', label: 'Kimi v2.7 (moonshot)', provider: 'opencode' },
      { id: 'opencode:moonshot/kimi-v3', label: 'Kimi v3 (moonshot)', provider: 'opencode' },
    ])
  })

  // Captured from `grok --output-format json`: the answer sits under `text`, and the
  // model narrates before emitting the JSON.
  const GROK_GROUPS_ENVELOPE = JSON.stringify({
    text: 'I\'ll group these by concern.{"groups":[{"files":["src/a.ts"],"subject":"Update A","body":""},{"files":["src/b.ts"],"subject":"Update B"}]}',
    stopReason: 'end_turn',
    sessionId: '019fca35-2d68-7982-b59d-3190760e9b87',
    usage: { input_tokens: 25_727, output_tokens: 247 },
  })

  it("reads Grok's answer out of the `text` envelope key it actually uses", () => {
    expect(parseGeneratedCommitGroups(GROK_GROUPS_ENVELOPE, ['src/a.ts', 'src/b.ts'])).toEqual([
      { files: ['src/a.ts'], message: 'Update A' },
      { files: ['src/b.ts'], message: 'Update B' },
    ])
  })

  it('takes the JSON a model narrates its way into rather than slicing brace to brace', () => {
    // First `{` … last `}` spans both objects here and parses as neither.
    const narrated = 'Considering {two} options.{"subject":"Add A"} then {"subject":"Add B"}'
    expect(jsonObjectCandidates(narrated)).toEqual([
      '{two}',
      '{"subject":"Add A"}',
      '{"subject":"Add B"}',
    ])
    // Braces inside strings must not open a span.
    expect(jsonObjectCandidates('{"subject":"a { b"}')).toEqual(['{"subject":"a { b"}'])
    expect(parseGeneratedCommitMessage(narrated)).toBe('Add B')
  })

  it('surfaces the reason a zero-exit Claude run failed instead of its stdin warning', () => {
    // Real shape: exit 0, the reason in the stdout envelope, only chatter on stderr.
    const stdout = JSON.stringify({
      is_error: true,
      subtype: 'success',
      result: 'Not logged in · Please run /login',
      type: 'result',
    })
    const stderr =
      'Warning: no stdin data received in 3s, proceeding without it. If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.\n'

    expect(claudeEnvelopeError(stdout)).toBe('Not logged in · Please run /login')
    expect(meaningfulOutput(stderr)).toBeNull()
    expect(cliFailure({ code: 0, stdout, stderr, timedOut: false }, 'claude')).toBe(
      'Not logged in · Please run /login',
    )
  })

  it('reports a timeout as a timeout, and never fails a clean run', () => {
    expect(cliFailure({ code: null, stdout: '', stderr: '', timedOut: true }, 'codex')).toBe(
      'codex did not respond within 180s',
    )
    expect(
      cliFailure(
        {
          code: 0,
          stdout: '{"subject":"Add A"}',
          stderr: 'Reading additional input from stdin...\n',
          timedOut: false,
        },
        'codex',
      ),
    ).toBeNull()
  })

  it('falls back to an exit code when a failing run says nothing useful', () => {
    expect(cliFailure({ code: 127, stdout: '', stderr: '', timedOut: false }, 'grok')).toBe(
      'grok exited with code 127',
    )
  })

  it('quotes the response back when it cannot be parsed', () => {
    expect(() => parseGeneratedCommitMessage('I cannot help with that.')).toThrow(
      'invalid commit message: I cannot help with that.',
    )
    expect(() => parseGeneratedCommitGroups('', ['src/a.ts'])).toThrow(
      'invalid commit groups: the response was empty',
    )
  })

  it('rejects unsafe group responses that omit or duplicate changed files', () => {
    expect(() =>
      parseGeneratedCommitGroups('{"groups":[{"files":["src/a.ts"],"subject":"Update A"}]}', [
        'src/a.ts',
        'src/b.ts',
      ]),
    ).toThrow('omitted a changed file')

    expect(() =>
      parseGeneratedCommitGroups(
        '{"groups":[{"files":["src/a.ts"],"subject":"Update A"},{"files":["src/a.ts"],"subject":"Update A again"}]}',
        ['src/a.ts'],
      ),
    ).toThrow('more than one commit group')
  })
})
