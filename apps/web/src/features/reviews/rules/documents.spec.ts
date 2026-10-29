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
