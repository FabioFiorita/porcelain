import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CommentSeenStore } from '../../src/ports/comment-seen-store.ts';

export type CommentSeenStoreSubject = {
  store: CommentSeenStore;
  close: () => void;
};

const first = 'a'.repeat(64);
const second = 'b'.repeat(64);
const third = 'c'.repeat(64);

export function commentSeenStoreContract(
  subject: string,
  openSubject: (worktreeIds: readonly string[]) => CommentSeenStoreSubject,
): void {
  describe(subject, () => {
    let opened: CommentSeenStoreSubject;
    let store: CommentSeenStore;

    beforeEach(() => {
      opened = openSubject([first, second, third]);
      store = opened.store;
    });

    afterEach(() => {
      opened.close();
    });

    it('answers nothing seen for a worktree that was never marked', () => {
      store.save({ worktreeId: second, seenThrough: 4 });
      expect(store.seenThrough({ worktreeId: first })).toBe(0);
    });

    it('answers the revision the worktree was last marked seen through', () => {
      store.save({ worktreeId: first, seenThrough: 3 });
      store.save({ worktreeId: first, seenThrough: 7 });
      expect(store.seenThrough({ worktreeId: first })).toBe(7);
    });

    it('reads the marks of the asked worktrees only, leaving out the unmarked ones', () => {
      store.save({ worktreeId: first, seenThrough: 1 });
      store.save({ worktreeId: second, seenThrough: 2 });
      expect(
        store
          .seenByWorktrees({ worktreeIds: [first, third] })
          .toSorted((left, right) =>
            left.worktreeId.localeCompare(right.worktreeId),
          ),
      ).toEqual([{ worktreeId: first, seenThrough: 1 }]);
    });

    it('reads no marks when no worktree is asked', () => {
      store.save({ worktreeId: first, seenThrough: 1 });
      expect(store.seenByWorktrees({ worktreeIds: [] })).toEqual([]);
    });
  });
}
