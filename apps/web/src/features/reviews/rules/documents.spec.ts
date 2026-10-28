import { expect, it } from 'vitest';
import {
  entryKey,
  parseEntry,
  publishedReviewTitle,
  surfaceTitles,
  workspaceTitle,
} from './documents.ts';

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

it('names the side panel views Files, Changes and History', () => {
  expect(surfaceTitles).toEqual({
    files: 'Files',
    changes: 'Changes',
    history: 'History',
  });
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
