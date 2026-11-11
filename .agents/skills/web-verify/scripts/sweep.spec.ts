import { expect, it } from 'vitest';
import { Refusal } from '../../verify-core/cli.ts';
import { indexMarkdown, sweepResult } from './sweep.ts';

it('reports a seeded first state as-left and links its captured evidence', () => {
  const report = indexMarkdown(
    { id: '1234abcd', detail: { desktop: false } },
    '/evidence/sweep',
    [{ entry: '/reviews' }],
    {
      states: ['as-left'],
      shots: [
        {
          target: 0,
          entry: '/reviews',
          path: '/reviews',
          state: 'as-left',
          theme: 'light',
          width: 1440,
          file: '/evidence/sweep/reviews/as-left/light-1440.png',
          problems: [],
        },
      ],
      composites: [],
      seeds: [{ variant: 'long-text', applied: false }],
      notes: [],
    },
  );
  expect(report).toContain(
    'States in order: as-left. An earlier sweep already seeded this instance',
  );
  expect(report).toContain(
    '| as-left | light | [pass](reviews/as-left/light-1440.png) | — | — |',
  );
  expect(report).toContain('## Problems\n\nNone.\n');
  expect(report).not.toContain('| as-is |');
});

it('fails a sweep on its first page error and retains one problem record without retries', () => {
  const found = {
    states: ['as-is'] as const,
    shots: [
      {
        target: 0,
        entry: '/reviews',
        state: 'as-is' as const,
        theme: 'light' as const,
        width: 1440 as const,
        file: '/evidence/sweep/reviews/as-is/light-1440.png',
        problems: ['page error: fixture failed'],
      },
    ],
    composites: [],
    seeds: [],
    notes: [],
  };
  const report = indexMarkdown(
    { id: '1234abcd', detail: { desktop: false } },
    '/evidence/sweep',
    [{ entry: '/reviews' }],
    { ...found, states: [...found.states] },
  );
  expect(report.match(/page error: fixture failed/g)).toHaveLength(1);
  expect(report).toContain(
    '- `/reviews` as-is light 1440: page error: fixture failed\n',
  );
  expect(report).toContain(
    '| as-is | light | [problem](reviews/as-is/light-1440.png) | — | — |',
  );
  expect(report).not.toContain('## Retries');
  const finish = () =>
    sweepResult(
      { ...found, states: [...found.states] },
      '/evidence/sweep/index.md',
      (value) => value,
    );
  expect(finish).toThrow(Refusal);
  expect(finish).toThrow(
    'The sweep found 1 problem in 1 captures. First: `/reviews` as-is light 1440: page error: fixture failed\nread /evidence/sweep/index.md',
  );
});
