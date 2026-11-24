import { describe, expect, it } from 'vite-plus/test';
import type { WalkthroughBlock } from '@porcelain/contracts/walkthroughs';
import { readStop, stepScreenshots } from './blocks.ts';

const step = (blocks: readonly WalkthroughBlock[]) =>
  readStop({ title: 'A step', explanation: 'Why it exists.', blocks });

const callout: WalkthroughBlock = {
  kind: 'callout',
  attention: { kind: 'product', note: 'It matters.', question: 'Keep it?' },
};
const excerpt = (start: number, end: number, side: 'new' | 'old' = 'new') =>
  ({
    kind: 'diff_excerpt',
    path: 'src/search.ts',
    side,
    start,
    end,
    caption: 'Empty matches all.',
    headOid: 'abcdef1234',
    contentTreeOid: 'tree',
  }) as const;
const checks = (
  state: string,
  results: readonly { name: string; status: string }[],
  checksTruncated = false,
) =>
  ({
    kind: 'checks',
    headOid: 'abcdef1234567',
    state,
    checksTruncated,
    results,
  }) as const;

describe('readStop', () => {
  it('keeps the writer’s order inside the step and lifts callouts to the calls', () => {
    const shaped = step([
      { kind: 'files', files: [{ path: 'a.ts', note: 'Owns it.' }] },
      callout,
      excerpt(2, 2),
      {
        kind: 'before_after',
        before: { assetId: 'b', shows: 'Before.' },
        after: { assetId: 'a', shows: 'After.' },
      },
      checks('SUCCESS', [{ name: 'Tests', status: 'SUCCESS' }]),
    ]);
    expect(shaped.blocks.map((block) => block.kind)).toEqual([
      'files',
      'excerpt',
      'images',
      'checks',
    ]);
    expect(shaped.callouts).toEqual([
      {
        attention: {
          kind: 'product',
          note: 'It matters.',
          question: 'Keep it?',
        },
        comparison: undefined,
      },
    ]);
  });

  it('addresses each excerpt by its saved position, counting every block before it', () => {
    const shaped = step([
      callout,
      { kind: 'files', files: [{ path: 'a.ts', note: 'Owns it.' }] },
      excerpt(2, 2),
      excerpt(4, 9, 'old'),
    ]);
    expect(shaped.blocks.filter((block) => block.kind === 'excerpt')).toEqual([
      {
        kind: 'excerpt',
        excerpt: {
          path: 'src/search.ts',
          side: 'new',
          start: 2,
          end: 2,
          caption: 'Empty matches all.',
          position: 3,
          lines: 'New line 2',
          span: { startLine: 2, endLine: 2 },
        },
      },
      {
        kind: 'excerpt',
        excerpt: {
          path: 'src/search.ts',
          side: 'old',
          start: 4,
          end: 9,
          caption: 'Empty matches all.',
          position: 4,
          lines: 'Old lines 4–9',
          span: { startLine: 4, endLine: 9 },
        },
      },
    ]);
  });

  it('keeps recorded checks for the PR rules to name', () => {
    expect(
      step([checks('FAILURE', [{ name: 'Unit', status: 'SUCCESS' }], true)])
        .blocks,
    ).toEqual([
      {
        kind: 'checks',
        checks: {
          headOid: 'abcdef1234567',
          state: 'FAILURE',
          checksTruncated: true,
          results: [{ name: 'Unit', status: 'SUCCESS' }],
        },
      },
    ]);
  });

  it('keeps a checks block with no listed results when GitHub had more', () => {
    expect(step([checks('PENDING', [], true)]).blocks).toEqual([
      {
        kind: 'checks',
        checks: {
          headOid: 'abcdef1234567',
          state: 'PENDING',
          checksTruncated: true,
          results: [],
        },
      },
    ]);
  });

  it('shows nothing for a step without evidence', () => {
    expect(step([checks('SUCCESS', []), { kind: 'files', files: [] }])).toEqual(
      {
        title: 'A step',
        explanation: 'Why it exists.',
        blocks: [],
        callouts: [],
      },
    );
  });

  it('keeps a well-formed comparison as a two-column table', () => {
    expect(
      step([
        {
          ...callout,
          comparison: {
            columns: ['Show all', 'Show none'],
            rows: [
              ['Browsing works', 'Quiet first view'],
              ['More to read', 'Less to read'],
            ],
          },
        },
      ]).callouts[0]?.comparison,
    ).toEqual({
      columns: ['Show all', 'Show none'],
      rows: [
        ['Browsing works', 'Quiet first view'],
        ['More to read', 'Less to read'],
      ],
    });
  });
});

it('labels each pair Before and After and numbers screenshots across the step', () => {
  const shaped = step([
    {
      kind: 'before_after',
      before: { assetId: 'b1', shows: 'Old list.' },
      after: { assetId: 'a1', shows: 'New list.' },
    },
    { kind: 'files', files: [{ path: 'a.ts', note: 'Owns it.' }] },
    {
      kind: 'before_after',
      before: { assetId: 'b2', shows: 'Old empty.' },
      after: { assetId: 'a2', shows: 'New empty.' },
    },
  ]);
  expect(
    shaped.blocks.flatMap((block) =>
      block.kind === 'images' ? [block.first] : [],
    ),
  ).toEqual([0, 2]);
  expect(
    stepScreenshots(shaped).map(({ assetId, label }) => `${label} ${assetId}`),
  ).toEqual(['Before b1', 'After a1', 'Before b2', 'After a2']);
});
