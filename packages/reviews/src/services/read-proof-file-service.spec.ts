import { describe, expect, it } from 'vitest';
import { ProofFileNotFoundError } from '@porcelain/reviews/errors';
import type { Review } from '@porcelain/reviews/models';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { ReadProofFileService } from './read-proof-file-service.ts';

const worktreeId = 'a'.repeat(64);
const otherWorktreeId = 'b'.repeat(64);

function review(id: string): Review {
  return {
    worktreeId: id,
    revision: 1,
    publishedAt: '2026-01-01T00:00:00.000Z',
    active: true,
    summaryHtml: '<p>Summary</p>',
    summaryToken: `token-${id.slice(0, 1)}`,
    summarySecret: 'secret',
    layers: [],
  };
}

function setup() {
  const store = new InMemoryReviewStore();
  store.save({
    ...review(worktreeId),
    proofFiles: [
      {
        id: 'shot',
        mediaType: 'image/png',
        bytes: new Uint8Array([0, 255, 1]),
      },
    ],
  });
  store.save(review(otherWorktreeId));
  return new ReadProofFileService(store, { base64ChunkBytes: 0x8000 });
}

describe('ReadProofFileService', () => {
  it('answers a stored proof file with its media type and base64 content', () => {
    expect(setup().execute({ worktreeId, proofId: 'shot' })).toEqual({
      id: 'shot',
      mediaType: 'image/png',
      base64: 'AP8B',
    });
  });

  it('refuses an id the review does not hold', () => {
    expect(() => setup().execute({ worktreeId, proofId: 'other' })).toThrow(
      ProofFileNotFoundError,
    );
  });

  it("refuses another worktree's proof file", () => {
    expect(() =>
      setup().execute({ worktreeId: otherWorktreeId, proofId: 'shot' }),
    ).toThrow(ProofFileNotFoundError);
  });
});
