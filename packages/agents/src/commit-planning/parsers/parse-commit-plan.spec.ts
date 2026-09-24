import { describe, expect, it } from 'vitest';
import { parseCommitPlan } from './parse-commit-plan.ts';

describe('parseCommitPlan', () => {
  it('reads the groups a model returned', () => {
    expect(
      parseCommitPlan({
        groups: [
          { message: 'Rename the guide', paths: ['OLD.md', 'GUIDE.md'] },
          { message: 'Describe the change', paths: ['README.md'] },
        ],
      }),
    ).toEqual([
      { message: 'Rename the guide', paths: ['OLD.md', 'GUIDE.md'] },
      { message: 'Describe the change', paths: ['README.md'] },
    ]);
  });

  it('refuses an answer that is not a plan', () => {
    for (const answer of [
      'Here is your commit message',
      { message: 'Fix', paths: ['README.md'] },
      { groups: [] },
      { groups: [{ message: '', paths: ['README.md'] }] },
      { groups: [{ message: 'Fix', paths: [] }] },
      { groups: [{ message: 'Fix', paths: ['README.md'], body: 'extra' }] },
    ])
      expect(() => parseCommitPlan(answer)).toThrow(
        'Commit generation failed.',
      );
  });

  it('refuses more than twenty groups', () => {
    const groups = Array.from({ length: 21 }, (_, index) => ({
      message: `Change ${index}`,
      paths: [`${index}.md`],
    }));
    expect(() => parseCommitPlan({ groups })).toThrow(
      'Commit generation failed.',
    );
  });
});
