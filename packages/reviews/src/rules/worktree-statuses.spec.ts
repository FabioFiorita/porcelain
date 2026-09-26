import { describe, expect, it } from 'vitest';
import type {
  AgentReply,
  CommentSeenMark,
  Review,
  ReviewLayer,
  WorktreeReviewedLayerMark,
} from '@porcelain/reviews/models';
import { currentLayerFingerprint } from '@porcelain/reviews/rules';
import { worktreeStatuses } from './worktree-statuses.ts';

const noTexts = new Map();

const worktreeId = 'worktree';
const otherWorktreeId = 'other-worktree';

function layer(id: string, fingerprint = `${id}-fingerprint`): ReviewLayer {
  return {
    id,
    title: id,
    summary: id,
    lanes: ['Code'],
    steps: [],
    fingerprint,
  };
}

function review(overrides: Partial<Review> = {}): Review {
  return {
    worktreeId,
    revision: 1,
    publishedAt: '2026-09-24T09:00:00.000Z',
    active: true,
    summaryHtml: '<p>Summary</p>',
    summaryToken: 'token',
    summarySecret: 'secret',
    layers: [layer('first'), layer('second')],
    ...overrides,
  };
}

function mark(
  layerId: string,
  overrides: Partial<WorktreeReviewedLayerMark> = {},
): WorktreeReviewedLayerMark {
  return {
    worktreeId,
    layerId,
    fingerprint: currentLayerFingerprint(layer(layerId), new Map()),
    reviewedAt: '2026-09-24T09:05:00.000Z',
    ...overrides,
  };
}

function reply(
  revision: number,
  owner = worktreeId,
  resolved = false,
): AgentReply {
  return {
    worktreeId: owner,
    threadId: `thread-${revision}`,
    revision,
    resolved,
  };
}

function seen(seenThrough: number, owner = worktreeId): CommentSeenMark {
  return { worktreeId: owner, seenThrough };
}

const bothMarked = [mark('first'), mark('second')];

describe('worktreeStatuses', () => {
  it('gives no status to a worktree with no review and no agent reply', () => {
    expect(
      worktreeStatuses([], [], [], [], noTexts).get(worktreeId),
    ).toBeUndefined();
  });

  it('marks a worktree reviewed when every layer of its active review has a fresh mark', () => {
    expect(
      worktreeStatuses([review()], bothMarked, [], [], noTexts).get(worktreeId),
    ).toBe('reviewed');
  });

  it('keeps a worktree pending while a layer has no mark', () => {
    expect(
      worktreeStatuses([review()], [mark('first')], [], [], noTexts).get(
        worktreeId,
      ),
    ).toBe('pending');
  });

  it('keeps a worktree pending when a mark was made for an earlier fingerprint of the layer', () => {
    expect(
      worktreeStatuses(
        [review()],
        [mark('first'), mark('second', { fingerprint: 'earlier' })],
        [],
        [],
        noTexts,
      ).get(worktreeId),
    ).toBe('pending');
  });

  it('keeps a worktree pending when the lines a mark covers changed since it was marked', () => {
    expect(
      worktreeStatuses(
        [review()],
        [
          mark('first'),
          mark('second', { fingerprint: 'an earlier fingerprint' }),
        ],
        [],
        [],
        noTexts,
      ).get(worktreeId),
    ).toBe('pending');
  });

  it('does not count marks made in another worktree', () => {
    expect(
      worktreeStatuses(
        [review()],
        bothMarked.map((entry) => ({ ...entry, worktreeId: otherWorktreeId })),
        [],
        [],
        noTexts,
      ).get(worktreeId),
    ).toBe('pending');
  });

  it('gives no review status for an inactive review or a review without layers', () => {
    const statuses = worktreeStatuses(
      [
        review({ active: false }),
        review({ worktreeId: otherWorktreeId, layers: [] }),
      ],
      bothMarked,
      [],
      [],
      noTexts,
    );
    expect(statuses.get(worktreeId)).toBeUndefined();
    expect(statuses.get(otherWorktreeId)).toBeUndefined();
  });

  it('reports an agent reply the owner has never seen, over the review status', () => {
    expect(
      worktreeStatuses([review()], bothMarked, [reply(3)], [], noTexts).get(
        worktreeId,
      ),
    ).toBe('replied');
  });

  it('does not report an agent reply on a thread resolved since', () => {
    expect(
      worktreeStatuses(
        [review()],
        bothMarked,
        [reply(3, worktreeId, true)],
        [],
        noTexts,
      ).get(worktreeId),
    ).toBe('reviewed');
  });

  it('reports a reply in a worktree that has no review', () => {
    expect(
      worktreeStatuses([], [], [reply(1)], [], noTexts).get(worktreeId),
    ).toBe('replied');
  });

  it('stops reporting replies once the seen mark reaches the latest one', () => {
    expect(
      worktreeStatuses(
        [review()],
        bothMarked,
        [reply(2), reply(4)],
        [seen(4)],
        noTexts,
      ).get(worktreeId),
    ).toBe('reviewed');
  });

  it('reports a reply written after the seen mark', () => {
    expect(
      worktreeStatuses([], [], [reply(2), reply(5)], [seen(4)], noTexts).get(
        worktreeId,
      ),
    ).toBe('replied');
  });

  it('does not let a seen mark of another worktree hide a reply', () => {
    expect(
      worktreeStatuses(
        [],
        [],
        [reply(2)],
        [seen(9, otherWorktreeId)],
        noTexts,
      ).get(worktreeId),
    ).toBe('replied');
  });
});
