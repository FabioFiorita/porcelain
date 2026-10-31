import { expect, it } from 'vitest';
import {
  entryKey,
  parseEntry,
  publishedReviewTitle,
  surfaceTitles,
  workspaceTitle,
} from './documents.ts';

it.each([
  ['files', 'Files'],
  ['changes', 'Changes'],
  ['history', 'History'],
] as const)(
  'names an empty %s workspace for its project and computer',
  (surface, title) => {
    expect(
      workspaceTitle({
        entry: undefined,
        surface,
        project: 'sample',
        environment: 'Remote',
      }),
    ).toBe(`${title} — sample · Remote`);
    expect(surfaceTitles[surface]).toBe(title);
  },
);

it('restores distinct all-changes and Specs documents after navigation or reload', () => {
  expect(parseEntry('all-changes')).toEqual({ kind: 'all-changes' });
  expect(parseEntry('specs')).toEqual({ kind: 'specs' });
  expect(entryKey({ kind: 'all-changes' })).toBe('all-changes');
  expect(entryKey({ kind: 'specs' })).toBe('specs');
  expect(
    workspaceTitle({ entry: 'specs', surface: 'changes', project: 'p' }),
  ).toBe('Specs — p');
});

it('names the current publication independently of whether its code is still active', () => {
  expect(publishedReviewTitle({ active: true })).toBe('Review');
  expect(publishedReviewTitle({ active: false })).toBe('Review');
  expect(publishedReviewTitle(undefined)).toBeUndefined();
  expect(publishedReviewTitle(null)).toBeUndefined();
});

it('restores a pull request tab and names it after reload', () => {
  expect(
    entryKey({
      kind: 'pull-request',
      reviewId: '10000000-0000-4000-8000-000000000001',
      number: 482,
    }),
  ).toBe('pull-request:10000000-0000-4000-8000-000000000001:482');
  expect(
    parseEntry('pull-request:10000000-0000-4000-8000-000000000001:482'),
  ).toEqual({
    kind: 'pull-request',
    reviewId: '10000000-0000-4000-8000-000000000001',
    number: 482,
  });
  expect(
    workspaceTitle({
      entry: 'pull-request:10000000-0000-4000-8000-000000000001:482',
      surface: 'changes',
      project: 'porcelain',
    }),
  ).toBe('PR #482 — porcelain');
});

it.each(['0', '-1', '1.5', '01', 'abc', '9007199254740992'])(
  'rejects invalid pull request tab number %s',
  (number) => {
    expect(
      parseEntry(`pull-request:10000000-0000-4000-8000-000000000001:${number}`),
    ).toBeNull();
  },
);

it.each([
  '482',
  'not-a-review:482',
  '10000000-0000-4000-8000-000000000001:482:extra',
])(
  'rejects a pull request tab without a valid retained review identity: %s',
  (value) => {
    expect(parseEntry(`pull-request:${value}`)).toBeNull();
  },
);

it.each([
  [
    'review-file:review-id:2:apps/web/src/file:variant.ts',
    {
      kind: 'review-file',
      reviewId: 'review-id',
      revision: 2,
      path: 'apps/web/src/file:variant.ts',
    },
  ],
  ['review-file:review-id:0:a.ts', null],
  ['review-file:review-id:1.5:a.ts', null],
  ['review-file:review-id:2:', null],
  ['review-file::2:a.ts', null],
])(
  'restores retained file tabs only with a valid revision and path: %s',
  (key, expected) => {
    expect(parseEntry(key)).toEqual(expected);
  },
);

it('keeps equal pull request and review IDs on two computers as separate tabs', () => {
  const reviewId = '10000000-0000-4000-8000-000000000001';
  const local = entryKey({
    kind: 'pull-request',
    reviewId,
    number: 482,
    environmentId: 'local-computer',
  });
  const remote = entryKey({
    kind: 'pull-request',
    reviewId,
    number: 482,
    environmentId: 'remote-computer',
  });
  expect(local).toBe(
    'pull-request:10000000-0000-4000-8000-000000000001:482:environment=local-computer',
  );
  expect(remote).toBe(
    'pull-request:10000000-0000-4000-8000-000000000001:482:environment=remote-computer',
  );
  expect(parseEntry(remote)).toEqual({
    kind: 'pull-request',
    reviewId,
    number: 482,
    environmentId: 'remote-computer',
  });
});
