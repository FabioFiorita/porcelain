import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReviewedLayerMark } from '../../src/models/reviewed-mark.ts';
import type { ReviewedLayerStore } from '../../src/ports/reviewed-layer-store.ts';

export type ReviewedLayerStoreSubject = {
  store: ReviewedLayerStore;
  close: () => void;
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
    stale: false,
  };
}

export function reviewedLayerStoreContract(
  subject: string,
  openSubject: (worktreeIds: readonly string[]) => ReviewedLayerStoreSubject,
): void {
  describe(subject, () => {
    let opened: ReviewedLayerStoreSubject;
    let store: ReviewedLayerStore;

    beforeEach(() => {
      opened = openSubject([first, second, third]);
      store = opened.store;
    });

    afterEach(() => {
      opened.close();
    });

    it('lists no marks for a worktree without reviewed layers', () => {
      store.save({ worktreeId: second, marks: [mark('layer')] });
      expect(store.list({ worktreeId: first })).toEqual([]);
    });

    it('lists the marks of the worktree in the order they were reviewed, then by layer', () => {
      store.save({
        worktreeId: first,
        marks: [mark('late', '2026-09-24T12:00:00.000Z')],
      });
      store.save({
        worktreeId: first,
        marks: [mark('b-early', '2026-09-24T09:00:00.000Z')],
      });
      store.save({
        worktreeId: first,
        marks: [mark('a-early', '2026-09-24T09:00:00.000Z')],
      });
      expect(
        store.list({ worktreeId: first }).map((entry) => entry.layerId),
      ).toEqual(['a-early', 'b-early', 'late']);
    });

    it('replaces the mark of a layer saved again', () => {
      store.save({ worktreeId: first, marks: [mark('layer')] });
      const again = {
        ...mark('layer', '2026-09-24T11:00:00.000Z'),
        fingerprint: 'newer',
      };
      store.save({ worktreeId: first, marks: [again] });
      expect(store.list({ worktreeId: first })).toEqual([again]);
    });

    it('reads the marks of the asked worktrees only, each with its worktree', () => {
      store.save({ worktreeId: first, marks: [mark('one')] });
      store.save({ worktreeId: second, marks: [mark('two')] });
      store.save({ worktreeId: third, marks: [mark('three')] });
      expect(
        store
          .byWorktrees({ worktreeIds: [first, third] })
          .toSorted((left, right) =>
            left.worktreeId.localeCompare(right.worktreeId),
          ),
      ).toEqual([
        { worktreeId: first, ...mark('one') },
        { worktreeId: third, ...mark('three') },
      ]);
    });

    it('reads no marks when no worktree is asked', () => {
      store.save({ worktreeId: first, marks: [mark('one')] });
      expect(store.byWorktrees({ worktreeIds: [] })).toEqual([]);
    });

    it('removes the mark of the asked layer in the asked worktree only', () => {
      store.save({ worktreeId: first, marks: [mark('kept')] });
      store.save({ worktreeId: first, marks: [mark('removed')] });
      store.save({ worktreeId: second, marks: [mark('removed')] });
      store.remove({ worktreeId: first, layerId: 'removed' });
      expect(store.list({ worktreeId: first })).toEqual([mark('kept')]);
      expect(store.list({ worktreeId: second })).toEqual([mark('removed')]);
    });

    it('marks the asked layers stale and fresh again, leaving the others', () => {
      store.save({ worktreeId: first, marks: [mark('a')] });
      store.save({ worktreeId: first, marks: [mark('b')] });
      store.save({ worktreeId: second, marks: [mark('a')] });
      store.setStale({ worktreeId: first, layerIds: ['a'], stale: true });
      expect(store.list({ worktreeId: first })).toEqual([
        { ...mark('a'), stale: true },
        mark('b'),
      ]);
      expect(store.list({ worktreeId: second })).toEqual([mark('a')]);
      store.setStale({ worktreeId: first, layerIds: ['a'], stale: false });
      expect(store.list({ worktreeId: first })).toEqual([mark('a'), mark('b')]);
    });

    it('hands out copies, so changing a returned mark leaves the stored one unchanged', () => {
      const saved = mark('layer');
      store.save({ worktreeId: first, marks: [saved] });
      saved.fingerprint = 'changed after saving';
      Object.assign(store.list({ worktreeId: first }).at(0) ?? {}, {
        fingerprint: 'changed after listing',
      });
      Object.assign(store.byWorktrees({ worktreeIds: [first] }).at(0) ?? {}, {
        fingerprint: 'changed after reading',
      });
      expect(store.list({ worktreeId: first })).toEqual([mark('layer')]);
    });
  });
}
