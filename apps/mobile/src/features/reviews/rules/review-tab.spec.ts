import { expect, it } from 'vitest';
import { walkthroughStops } from '@porcelain/client/reviews/rules';
import { reviewTab } from './review-tab';

const stops = walkthroughStops(
  {
    layers: ['first', 'second'].map((id) => ({
      id,
      title: id,
      summary: id,
      fingerprint: id,
      lanes: [],
      steps: [],
    })),
    notExplained: [],
  },
  [],
  { specsApart: true },
);
const progress = {
  stops: stops.map((stop) =>
    stop.kind === 'decision'
      ? { ...stop, paths: [`${stop.layer.id}.ts`] }
      : stop,
  ),
  items: [
    { path: 'first.ts', reviewStatus: 'reviewed' as const },
    { path: 'second.ts', reviewStatus: 'unreviewed' as const },
  ],
  decisions: new Map(
    ['first', 'second'].map((id) => [id, { reviewed: true, stale: false }]),
  ),
};

it.each([
  [false, { title: 'Changes', progress: undefined }],
  [undefined, { title: 'Review', progress: undefined }],
  [true, { title: 'Review', progress: undefined }],
] as const)(
  'names the first tab while publication is %s and progress unavailable',
  (published, expected) => {
    expect(reviewTab(published, undefined, { kind: 'worktree' })).toEqual(
      expected,
    );
  },
);

it('counts the same completed decisions as the page, requiring both marks and reviewed files', () => {
  expect(reviewTab(true, progress, { kind: 'worktree' })).toEqual({
    title: 'Review',
    progress: '1/2',
  });
  expect(
    reviewTab(true, { ...progress, items: [] }, { kind: 'worktree' }),
  ).toEqual({ title: 'Review', progress: '0/2' });
  expect(
    reviewTab(
      true,
      { ...progress, decisions: new Map() },
      { kind: 'worktree' },
    ),
  ).toEqual({ title: 'Review', progress: '0/2' });
  expect(
    reviewTab(
      true,
      {
        ...progress,
        items: progress.items.map((item) => ({
          ...item,
          reviewStatus: 'reviewed',
        })),
      },
      { kind: 'worktree' },
    ),
  ).toEqual({ title: 'Review', progress: '2/2' });
});

it('omits progress for a zero-decision review', () => {
  expect(
    reviewTab(true, { ...progress, stops: [] }, { kind: 'worktree' }),
  ).toEqual({ title: 'Review', progress: undefined });
});

it.each([
  [true, { title: 'Review', progress: undefined }],
  [false, { title: 'Changes', progress: undefined }],
] as const)(
  'drops the count during a Branch comparison, published %s',
  (published, expected) => {
    expect(
      reviewTab(published, progress, { kind: 'branch', base: 'main' }),
    ).toEqual(expected);
  },
);
