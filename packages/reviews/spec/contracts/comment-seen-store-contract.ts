import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CommentSeenStore } from '../../src/ports/comment-seen-store.ts';

export type CommentSeenStoreSubject = {
  store: CommentSeenStore;
  close: () => Promise<void> | void;
};

const first = 'a'.repeat(64);
const second = 'b'.repeat(64);
const third = 'c'.repeat(64);

export function commentSeenStoreContract(
  subject: string,
  openSubject: (
    worktreeIds: readonly string[],
  ) => CommentSeenStoreSubject | Promise<CommentSeenStoreSubject>,
): void {
  describe(subject, () => {
    let opened: CommentSeenStoreSubject;
    let store: CommentSeenStore;

    beforeEach(async () => {
      opened = await openSubject([first, second, third]);
      store = opened.store;
    });

    afterEach(async () => {
      await opened.close();
    });

    it('answers nothing seen for a worktree that was never marked', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: second, seenThrough: 4 }),
      );
      expect(
        await Effect.runPromise(store.seenThrough({ worktreeId: first })),
      ).toBe(0);
    });

    it('answers the revision the worktree was last marked seen through', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: first, seenThrough: 3 }),
      );
      await Effect.runPromise(
        store.save({ worktreeId: first, seenThrough: 7 }),
      );
      expect(
        await Effect.runPromise(store.seenThrough({ worktreeId: first })),
      ).toBe(7);
    });

    it('reads the marks of the asked worktrees only, leaving out the unmarked ones', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: first, seenThrough: 1 }),
      );
      await Effect.runPromise(
        store.save({ worktreeId: second, seenThrough: 2 }),
      );
      expect(
        (
          await Effect.runPromise(
            store.seenByWorktrees({ worktreeIds: [first, third] }),
          )
        ).toSorted((left, right) =>
          left.worktreeId.localeCompare(right.worktreeId),
        ),
      ).toEqual([{ worktreeId: first, seenThrough: 1 }]);
    });

    it('reads no marks when no worktree is asked', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: first, seenThrough: 1 }),
      );
      expect(
        await Effect.runPromise(store.seenByWorktrees({ worktreeIds: [] })),
      ).toEqual([]);
    });
  });
}
