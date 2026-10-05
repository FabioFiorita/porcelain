import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReviewedLayerMark } from '../../src/models/reviewed-mark.ts';
import type { ReviewedLayerStore } from '../../src/ports/reviewed-layer-store.ts';

export type ReviewedLayerStoreSubject = {
  store: ReviewedLayerStore;
  close: () => Promise<void> | void;
};

const first = 'a'.repeat(64);
const second = 'b'.repeat(64);
const third = 'c'.repeat(64);

function mark(
  layerId: string,
  reviewedAt = '2026-09-24T10:00:00.000Z',
): ReviewedLayerMark {
  return {
    layerId,
    fingerprint: `fingerprint-${layerId}`,
    reviewedAt,
  };
}

export function reviewedLayerStoreContract(
  subject: string,
  openSubject: (
    worktreeIds: readonly string[],
  ) => ReviewedLayerStoreSubject | Promise<ReviewedLayerStoreSubject>,
): void {
  describe(subject, () => {
    let opened: ReviewedLayerStoreSubject;
    let store: ReviewedLayerStore;

    beforeEach(async () => {
      opened = await openSubject([first, second, third]);
      store = opened.store;
    });

    afterEach(async () => {
      await opened.close();
    });

    it('lists no marks for a worktree without reviewed layers', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: second, marks: [mark('layer')] }),
      );
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([]);
    });

    it('lists the marks of the worktree in the order they were reviewed, then by layer', async () => {
      await Effect.runPromise(
        store.save({
          worktreeId: first,
          marks: [mark('late', '2026-09-24T12:00:00.000Z')],
        }),
      );
      await Effect.runPromise(
        store.save({
          worktreeId: first,
          marks: [mark('b-early', '2026-09-24T09:00:00.000Z')],
        }),
      );
      await Effect.runPromise(
        store.save({
          worktreeId: first,
          marks: [mark('a-early', '2026-09-24T09:00:00.000Z')],
        }),
      );
      expect(
        (await Effect.runPromise(store.list({ worktreeId: first }))).map(
          (entry) => entry.layerId,
        ),
      ).toEqual(['a-early', 'b-early', 'late']);
    });

    it('replaces the mark of a layer saved again', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: first, marks: [mark('layer')] }),
      );
      const again = {
        ...mark('layer', '2026-09-24T11:00:00.000Z'),
        fingerprint: 'newer',
      };
      await Effect.runPromise(
        store.save({ worktreeId: first, marks: [again] }),
      );
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([again]);
    });

    it('reads the marks of the asked worktrees only, each with its worktree', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: first, marks: [mark('one')] }),
      );
      await Effect.runPromise(
        store.save({ worktreeId: second, marks: [mark('two')] }),
      );
      await Effect.runPromise(
        store.save({ worktreeId: third, marks: [mark('three')] }),
      );
      expect(
        (
          await Effect.runPromise(
            store.byWorktrees({ worktreeIds: [first, third] }),
          )
        ).toSorted((left, right) =>
          left.worktreeId.localeCompare(right.worktreeId),
        ),
      ).toEqual([
        { worktreeId: first, ...mark('one') },
        { worktreeId: third, ...mark('three') },
      ]);
    });

    it('reads no marks when no worktree is asked', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: first, marks: [mark('one')] }),
      );
      expect(
        await Effect.runPromise(store.byWorktrees({ worktreeIds: [] })),
      ).toEqual([]);
    });

    it('removes the mark of the asked layer in the asked worktree only', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: first, marks: [mark('kept')] }),
      );
      await Effect.runPromise(
        store.save({ worktreeId: first, marks: [mark('removed')] }),
      );
      await Effect.runPromise(
        store.save({ worktreeId: second, marks: [mark('removed')] }),
      );
      await Effect.runPromise(
        store.remove({ worktreeId: first, layerId: 'removed' }),
      );
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([mark('kept')]);
      expect(
        await Effect.runPromise(store.list({ worktreeId: second })),
      ).toEqual([mark('removed')]);
    });

    it('hands out copies, so changing a returned mark leaves the stored one unchanged', async () => {
      const saved = mark('layer');
      await Effect.runPromise(
        store.save({ worktreeId: first, marks: [saved] }),
      );
      saved.fingerprint = 'changed after saving';
      Object.assign(
        (await Effect.runPromise(store.list({ worktreeId: first }))).at(0) ??
          {},
        {
          fingerprint: 'changed after listing',
        },
      );
      Object.assign(
        (
          await Effect.runPromise(store.byWorktrees({ worktreeIds: [first] }))
        ).at(0) ?? {},
        {
          fingerprint: 'changed after reading',
        },
      );
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([mark('layer')]);
    });
  });
}
