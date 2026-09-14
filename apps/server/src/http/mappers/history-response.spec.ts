import { commitPageResponseSchema } from '@porcelain/contracts/commit-history';
import type { CommitPage } from '@porcelain/git/dtos/commit-history';
import { describe, expect, it } from 'vitest';
import { toCommitPageResponse } from './history-response.ts';

describe('history response mapping', () => {
  it('maps body metadata and keeps full ref names in the HTTP contract', () => {
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
          refs: ['refs/heads/main', 'refs/tags/v1'],
        },
      ],
      nextCursor: null,
      boundary: null,
    };

    const response = toCommitPageResponse(page);
    expect(response.commits[0]).toEqual(page.commits[0]);
    expect(commitPageResponseSchema.parse(response)).toEqual(response);
  });
});
