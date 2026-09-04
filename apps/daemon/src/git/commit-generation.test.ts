// @vitest-environment node

import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
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
  recentCommitSubjects,
  repoCommitStyle,
} from './commit-generation'

const execFileAsync = promisify(execFile)

async function initRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'porcelain-commit-style-'))
  await execFileAsync('git', ['init', '--initial-branch=main'], { cwd: dir })
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir })
  await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: dir })
  return dir
}

async function commit(dir: string, subject: string): Promise<void> {
  await writeFile(join(dir, `${Date.now()}-${Math.random()}.txt`), subject)
  await execFileAsync('git', ['add', '-A'], { cwd: dir })
  await execFileAsync('git', ['commit', '-m', subject], { cwd: dir })
}

describe('commit generation', () => {
  const scratchDirs: string[] = []
  afterEach(async () => {
    await Promise.all(scratchDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('prepends user install bins so GUI/systemd daemons still find claude/codex/grok', () => {
    const home = join(tmpdir(), 'porcelain-agent-cli-home')
    const inherited = [join(tmpdir(), 'bin-a'), join(tmpdir(), 'bin-b')].join(delimiter)
    const path = agentCliPath(inherited, home)
    expect(path.startsWith(`${join(home, '.local', 'bin')}${delimiter}`)).toBe(true)
    expect(path).toContain(join(home, '.volta', 'bin'))
    expect(path).toContain(join(home, '.grok', 'bin'))
    expect(path.endsWith(inherited)).toBe(true)
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

  it('leaves the prompt unchanged when there is no observed style to match', () => {
    const withStyle = buildCommitGenerationPrompt({
      mode: 'single',
      branch: 'main',
      files: ['src/commit.ts'],
      summary: 'M\tsrc/commit.ts',
      patch: '+x\n',
      styleSamples: [],
      styleGuidance: null,
    })
    const without = buildCommitGenerationPrompt({
      mode: 'single',
      branch: 'main',
      files: ['src/commit.ts'],
      summary: 'M\tsrc/commit.ts',
      patch: '+x\n',
    })

    expect(withStyle).toBe(without)
    expect(without).not.toContain('observed commit style')
    expect(without).not.toContain('Recent commit subjects')
  })

  it('includes sampled subjects and a match-the-style instruction when history is supplied', () => {
    const prompt = buildCommitGenerationPrompt({
      mode: 'single',
      branch: 'main',
      files: ['src/commit.ts'],
      summary: 'M\tsrc/commit.ts',
      patch: '+x\n',
      styleSamples: ['feat(git): add commit generation', 'fix(web): correct commit group order'],
      styleGuidance:
        'Commitlint config (.commitlintrc.json):\n{"extends":["@commitlint/config-conventional"]}',
    })

    expect(prompt).toContain("match this repository's observed commit style")
    expect(prompt).toContain('Recent commit subjects from this repository (match this style):')
    expect(prompt).toContain('- feat(git): add commit generation')
    expect(prompt).toContain('- fix(web): correct commit group order')
    expect(prompt).toContain('Repository commit conventions:')
    expect(prompt).toContain('@commitlint/config-conventional')
  })

  it('tells the model the observed style outranks the generic subject defaults, only when style is present', () => {
    const without = buildCommitGenerationPrompt({
      mode: 'single',
      branch: 'main',
      files: ['src/commit.ts'],
      summary: 'M\tsrc/commit.ts',
      patch: '+x\n',
    })
    const withStyle = buildCommitGenerationPrompt({
      mode: 'single',
      branch: 'main',
      files: ['src/commit.ts'],
      summary: 'M\tsrc/commit.ts',
      patch: '+x\n',
      styleSamples: ['Fixed the login bug.'],
      styleGuidance: null,
    })

    expect(without).not.toContain('takes precedence')
    expect(without).toContain(
      '- each subject must be imperative, no more than 72 characters, and have no trailing period',
    )
    expect(withStyle).toContain('takes precedence over these defaults')
    expect(withStyle).toContain(
      'by default each subject must be imperative, no more than 72 characters, and have no trailing period',
    )
  })

  it('samples recent conventional-commit subjects and detects CONTRIBUTING commit guidance', async () => {
    const dir = await initRepo()
    scratchDirs.push(dir)
    await commit(dir, 'chore: scaffold repo')
    await commit(dir, 'feat(auth): add login form')
    await commit(dir, 'fix(auth): correct redirect loop')
    await writeFile(
      join(dir, 'CONTRIBUTING.md'),
      [
        '# Contributing',
        '',
        'Read the code before you change it.',
        '',
        '## Commit messages',
        '',
        'Use conventional commits: `type(scope): imperative summary`, no trailing period.',
      ].join('\n'),
    )

    const style = await repoCommitStyle(dir)

    expect(style.styleSamples).toEqual([
      'fix(auth): correct redirect loop',
      'feat(auth): add login form',
      'chore: scaffold repo',
    ])
    expect(style.styleGuidance).toContain('CONTRIBUTING.md commit guidance')
    expect(style.styleGuidance).toContain('conventional commits')
  })

  it('keeps current behavior — no samples, no guidance — when the repo has no commits yet', async () => {
    const dir = await initRepo()
    scratchDirs.push(dir)
    await writeFile(join(dir, 'CONTRIBUTING.md'), '## Commit messages\n\nUse conventional commits.')

    const subjects = await recentCommitSubjects(dir)
    const style = await repoCommitStyle(dir)

    expect(subjects).toEqual([])
    expect(style).toEqual({ styleSamples: [], styleGuidance: null })
  })

  it('skips an oversized convention candidate instead of reading it in full', async () => {
    const dir = await initRepo()
    scratchDirs.push(dir)
    await commit(dir, 'chore: scaffold repo')
    // One paragraph over the 256 KB cap, still matching /commit/i so it would
    // otherwise be picked up by extractCommitGuidance.
    const oversized = `## Commit messages\n\n${'x'.repeat(256 * 1024 + 1)} commit`
    await writeFile(join(dir, 'CONTRIBUTING.md'), oversized)

    const style = await repoCommitStyle(dir)

    expect(style.styleGuidance).toBeNull()
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
