import { commitPageResponseSchema } from '@porcelain/contracts/commit-history';
import type { CommitPage } from '@porcelain/git/dtos/commit-history';
import { describe, expect, it } from 'vitest';
import { toCommitPageResponse } from './history-response.ts';

describe('history response mapping', () => {
  it('maps a page read from the top, refs and all', () => {
    const page: CommitPage = {
      snapshot: {
        tipOid: 'a'.repeat(40),
        head: { kind: 'attached', ref: 'refs/heads/main' },
      },
      commits: [
        {
          oid: 'a'.repeat(40),
          parentOids: [],
          author: { name: 'Ada', timestamp: '2026-09-14T00:00:00.000Z' },
          subject: 'Subject',
          subjectTruncated: false,
          body: 'line one\nline two',
          bodyTruncated: false,
          refs: ['main', 'v1'],
        },
      ],
      nextAfter: null,
      tip: 'a'.repeat(40),
      boundary: null,
      restarted: false,
    };

    const response = toCommitPageResponse(page);
    expect(response.commits[0]).toEqual(page.commits[0]);
    expect(response.snapshot).toEqual(page.snapshot);
    expect(commitPageResponseSchema.parse(response)).toEqual(response);
  });

  /**
   * A continuation is anchored to a commit and never looks at the branch, so
   * it has nothing to say about HEAD rather than a stale guess at it.
   */
  it('maps a continuation, which has no snapshot', () => {
    const page: CommitPage = {
      snapshot: null,
      commits: [],
      nextAfter: ['b'.repeat(40)],
      tip: 'a'.repeat(40),
      boundary: null,
      restarted: true,
    };
    const response = toCommitPageResponse(page);
    expect(response.snapshot).toBeNull();
    expect(response.restarted).toBe(true);
    expect(commitPageResponseSchema.parse(response)).toEqual(response);
  });
});
