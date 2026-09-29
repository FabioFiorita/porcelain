import { describe, expect, it } from 'vitest';
import { readinessItems, readinessSummary } from './readiness.ts';

type Input = Parameters<typeof readinessItems>[0];
type Review = NonNullable<Input['review']>;
type CommentThread = Input['threads'][number];

const clean: Review = {
  notExplained: [],
  proof: {
    checks: [{ name: 'Tests', result: 'pass' }],
    assets: [],
    current: true,
  },
};

function thread(
  authors: ('reviewer' | 'agent')[],
  resolved = false,
): CommentThread {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    worktreeId: 'a'.repeat(32),
    anchor: { kind: 'file', filePath: 'a.ts' },
    resolved,
    revision: 1,
    messages: authors.map((author, index) => ({
      id: `00000000-0000-4000-8000-00000000001${index}`,
      body: 'Comment',
      author,
    })),
  };
}

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
    expect(readinessSummary(items)).toBe('Nothing left to check');
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
    expect(readinessSummary(items)).toBe('5 things to check');
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
      tone: 'attention',
    });
    expect(items.find((item) => item.key === 'checks')).toEqual({
      key: 'checks',
      label: 'No checks attached',
      tone: 'attention',
    });
  });

  it('counts skipped checks as not yet proven', () => {
    const items = readinessItems({
      files: [],
      review: {
        notExplained: [],
        proof: {
          checks: [
            { name: 'Tests', result: 'pass' },
            { name: 'E2E', result: 'skipped' },
          ],
          assets: [],
          current: true,
        },
      },
      explains: false,
      threads: [],
    });
    expect(items.map((item) => [item.key, item.label, item.tone])).toEqual([
      ['files', 'No changed files', 'ok'],
      ['stale', 'No marks went stale', 'ok'],
      ['comments', 'No open comments', 'ok'],
      ['checks', '1 check skipped', 'attention'],
    ]);
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
        tone: 'attention',
      },
      { key: 'replies', label: '2 comments waiting on you', tone: 'attention' },
    ]);
    expect(readinessSummary(items)).toBe('2 things to check');
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
      tone: 'attention',
    });
    expect(readinessSummary(items)).toBe('1 thing to check');
  });
});
