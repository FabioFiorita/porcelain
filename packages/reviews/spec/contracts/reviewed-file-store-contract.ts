import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReviewedFileMark } from '../../src/models/reviewed-mark.ts';
import type { ReviewedFileStore } from '../../src/ports/reviewed-file-store.ts';

export type ReviewedFileStoreSubject = {
  store: ReviewedFileStore;
  close: () => void;
};

const first = 'a'.repeat(64);
const second = 'b'.repeat(64);

function mark(
  path: string,
  fingerprint = `fingerprint-${path}`,
): ReviewedFileMark {
  return {
    path,
    fingerprint,
    reviewedAt: '2026-09-24T10:00:00.000Z',
    stale: false,
  };
}

export function reviewedFileStoreContract(
  subject: string,
  openSubject: (worktreeIds: readonly string[]) => ReviewedFileStoreSubject,
): void {
  describe(subject, () => {
    let opened: ReviewedFileStoreSubject;
    let store: ReviewedFileStore;

    beforeEach(() => {
      opened = openSubject([first, second]);
      store = opened.store;
    });

    afterEach(() => {
      opened.close();
    });

    it('lists no marks for a worktree without reviewed files', () => {
      store.save({ worktreeId: second, marks: [mark('README.md')] });
      expect(store.list({ worktreeId: first })).toEqual([]);
    });

    it('lists the saved marks of the worktree in path order', () => {
      store.save({
        worktreeId: first,
        marks: [mark('src/b.ts'), mark('README.md'), mark('src/a.ts')],
      });
      expect(store.list({ worktreeId: first })).toEqual([
        mark('README.md'),
        mark('src/a.ts'),
        mark('src/b.ts'),
      ]);
    });

    it('keeps the marks of each worktree apart', () => {
      store.save({ worktreeId: first, marks: [mark('README.md', 'first')] });
      store.save({ worktreeId: second, marks: [mark('README.md', 'second')] });
      expect(store.list({ worktreeId: first })).toEqual([
        mark('README.md', 'first'),
      ]);
    });

    it('replaces the mark of a path saved again and keeps the others', () => {
      store.save({ worktreeId: first, marks: [mark('a.ts'), mark('b.ts')] });
      const again = { ...mark('a.ts', 'newer'), stale: true };
      store.save({ worktreeId: first, marks: [again] });
      expect(store.list({ worktreeId: first })).toEqual([again, mark('b.ts')]);
    });

    it('changes nothing when no marks are saved', () => {
      store.save({ worktreeId: first, marks: [mark('a.ts')] });
      store.save({ worktreeId: first, marks: [] });
      expect(store.list({ worktreeId: first })).toEqual([mark('a.ts')]);
    });

    it('removes the marks of the asked paths in the asked worktree only', () => {
      store.save({
        worktreeId: first,
        marks: [mark('a.ts'), mark('b.ts'), mark('c.ts')],
      });
      store.save({ worktreeId: second, marks: [mark('a.ts')] });
      store.remove({
        worktreeId: first,
        paths: ['a.ts', 'c.ts', 'unknown.ts'],
      });
      expect(store.list({ worktreeId: first })).toEqual([mark('b.ts')]);
      expect(store.list({ worktreeId: second })).toEqual([mark('a.ts')]);
    });

    it('marks the asked paths stale and fresh again, leaving the others', () => {
      store.save({ worktreeId: first, marks: [mark('a.ts'), mark('b.ts')] });
      store.save({ worktreeId: second, marks: [mark('a.ts')] });
      store.setStale({ worktreeId: first, paths: ['a.ts'], stale: true });
      expect(store.list({ worktreeId: first })).toEqual([
        { ...mark('a.ts'), stale: true },
        mark('b.ts'),
      ]);
      expect(store.list({ worktreeId: second })).toEqual([mark('a.ts')]);
      store.setStale({ worktreeId: first, paths: ['a.ts'], stale: false });
      expect(store.list({ worktreeId: first })).toEqual([
        mark('a.ts'),
        mark('b.ts'),
      ]);
    });

    it('hands out copies, so changing a returned mark leaves the stored one unchanged', () => {
      const saved = mark('a.ts');
      store.save({ worktreeId: first, marks: [saved] });
      saved.fingerprint = 'changed after saving';
      Object.assign(store.list({ worktreeId: first }).at(0) ?? {}, {
        fingerprint: 'changed after listing',
      });
      expect(store.list({ worktreeId: first })).toEqual([mark('a.ts')]);
    });
  });
}
