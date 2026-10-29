import { describe, expect, it } from 'vitest';
import { commentThread as thread } from '../../../../spec/kit/comment-thread.ts';
import { readinessItems } from './readiness.ts';

type Input = Parameters<typeof readinessItems>[0];
type Review = NonNullable<Input['review']>;

const clean: Review = {
  notExplained: [],
  proof: {
    checks: [{ name: 'Tests', result: 'pass' }],
    assets: [],
    current: true,
  },
};

describe('readinessItems', () => {
  it('reports a fully reviewed, explained and proven change as ready', () => {
    const items = readinessItems({
      files: [{ reviewStatus: 'reviewed' }, { reviewStatus: 'reviewed' }],
      review: clean,
      explains: true,
      threads: [thread(['reviewer', 'agent'], true)],
    });
    expect(items.map((item) => [item.key, item.label, item.tone])).toEqual([
      ['files', '2 of 2 files reviewed', 'ok'],
      ['stale', 'No marks went stale', 'ok'],
      ['unexplained', 'Every change explained', 'ok'],
      ['comments', 'No open comments', 'ok'],
      ['checks', '1 check passed', 'ok'],
    ]);
  });

  it('counts unreviewed and stale files, unexplained lines, waiting comments and failing checks', () => {
    const items = readinessItems({
      files: [
        { reviewStatus: 'reviewed' },
        { reviewStatus: 'stale' },
        { reviewStatus: 'unreviewed' },
      ],
      review: {
        notExplained: [
          {
            path: 'a.ts',
            ranges: [
              { startLine: 1, endLine: 2 },
              { startLine: 9, endLine: 9 },
            ],
          },
        ],
        proof: {
          checks: [
            { name: 'Tests', result: 'pass' },
            { name: 'Journey', result: 'fail' },
          ],
          assets: [],
          current: true,
        },
      },
      explains: true,
      threads: [
        thread(['reviewer']),
        thread(['agent', 'reviewer']),
        thread(['reviewer'], true),
      ],
    });
    expect(items.map((item) => [item.label, item.tone])).toEqual([
      ['1 of 3 files reviewed', 'attention'],
      ['1 mark changed since reviewed', 'attention'],
      ['3 lines in 1 file not explained', 'attention'],
      ['2 comments waiting on the agent', 'attention'],
      ['1 of 2 checks failing', 'failing'],
    ]);
    expect(items.map((item) => item.value)).toEqual([
      '1 of 3 reviewed',
      '1 changed',
      '3 lines in 1 file',
      '2 awaiting agent',
      '1 of 2 failing',
    ]);
  });

  it('asks for checks and a review when the agent published neither', () => {
    const items = readinessItems({
      files: [{ reviewStatus: 'reviewed' }],
      review: null,
      explains: true,
      threads: [],
    });
    expect(items.find((item) => item.key === 'unexplained')).toEqual({
      key: 'unexplained',
      label: 'No review published',
      value: 'No review',
      tone: 'attention',
    });
    expect(items.find((item) => item.key === 'checks')).toEqual({
      key: 'checks',
      label: 'No checks attached',
      value: 'None attached',
      tone: 'attention',
    });
  });

  it('counts an open thread the agent answered last as waiting on the reviewer', () => {
    const items = readinessItems({
      files: [{ reviewStatus: 'reviewed' }],
      review: clean,
      explains: true,
      threads: [
        thread(['agent']),
        thread(['reviewer', 'agent']),
        thread(['reviewer']),
      ],
    });
    expect(
      items.filter((item) => item.key === 'comments' || item.key === 'replies'),
    ).toEqual([
      {
        key: 'comments',
        label: '1 comment waiting on the agent',
        value: '1 awaiting agent',
        tone: 'attention',
      },
      {
        key: 'replies',
        label: '2 comments waiting on you',
        value: '2 awaiting you',
        tone: 'attention',
      },
    ]);
  });

  it('asks for the checks again once the code changed after they ran', () => {
    const items = readinessItems({
      files: [{ reviewStatus: 'reviewed' }],
      review: { ...clean, proof: { ...clean.proof, current: false } },
      explains: true,
      threads: [],
    });
    expect(items.find((item) => item.key === 'checks')).toEqual({
      key: 'checks',
      label: 'Checks ran before the latest changes',
      value: 'Outdated',
      tone: 'attention',
    });
  });
});
