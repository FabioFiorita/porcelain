import type { ListFileCommitsResponse } from '@porcelain/contracts/changes';
import { expect, test } from 'vitest';
import { fileTimelineWindow } from './history.ts';

function page(oid: string, subject: string): ListFileCommitsResponse {
  return {
    commits: [
      {
        commit: {
          oid,
          subject,
          subjectTruncated: false,
          bodyTruncated: false,
          body: undefined,
          parentOids: [],
          author: { name: 'Author', timestamp: '2026-11-01T00:00:00Z' },
          refs: [],
        },
        path: 'notes.md',
        previousPath: undefined,
        status: 'modified',
      },
    ],
    tip: oid,
    nextAfter: undefined,
    boundary: undefined,
    restarted: false,
  };
}

test('a restarted file timeline discards old pages and keeps the replacement order, continuation and shallow boundary', () => {
  const old = page('a'.repeat(40), 'Old checkout');
  const replacement = {
    ...page('b'.repeat(40), 'Replacement'),
    restarted: true,
  };
  const last = {
    ...page('c'.repeat(40), 'Older replacement'),
    boundary: 'shallow' as const,
  };
  const result = fileTimelineWindow([old, replacement, last]);
  expect(result.commits.map((entry) => entry.commit.subject)).toEqual([
    'Replacement',
    'Older replacement',
  ]);
  expect(result.tip).toBe('b'.repeat(40));
  expect(result.nextAfter).toBeNull();
  expect(result.boundary).toBe('shallow');
  expect(result.restarted).toBe(true);
});
