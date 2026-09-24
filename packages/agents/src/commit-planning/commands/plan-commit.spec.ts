import { describe, expect, it } from 'vitest';
import { commitPlanPrompt } from './plan-commit.ts';

const request = {
  mode: 'message' as const,
  model: 'claude:sonnet',
  paths: ['README.md', 'docs/guide.md'],
  evidence: '{"patch":"diff"}',
};

describe('commitPlanPrompt', () => {
  it('asks for exactly one commit message in message mode', () => {
    expect(commitPlanPrompt(request)).toContain(
      'Write exactly one concise commit message.',
    );
  });

  it('asks for a sequence of cohesive commits in groups mode', () => {
    expect(commitPlanPrompt({ ...request, mode: 'groups' })).toContain(
      'Write a small sequence of cohesive commits, in dependency order.',
    );
  });

  it('hands over the selected paths and the evidence as data', () => {
    const prompt = commitPlanPrompt(request);
    expect(prompt).toContain('Selected paths: ["README.md","docs/guide.md"]');
    expect(prompt.endsWith('Selected changes:\n{"patch":"diff"}')).toBe(true);
  });
});
