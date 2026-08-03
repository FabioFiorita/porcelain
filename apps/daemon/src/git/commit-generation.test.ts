// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  buildCommitGenerationPrompt,
  parseGeneratedCommitGroups,
  parseGeneratedCommitMessage,
  parseOpenCodeCommitModels,
} from './commit-generation'

describe('commit generation', () => {
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
