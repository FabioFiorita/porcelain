import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReviewedFileMark } from '../../src/models/reviewed-mark.ts';
import type { ReviewedFileStore } from '../../src/ports/reviewed-file-store.ts';

export type ReviewedFileStoreSubject = {
  store: ReviewedFileStore;
  close: () => Promise<void> | void;
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
  openSubject: (
    worktreeIds: readonly string[],
  ) => ReviewedFileStoreSubject | Promise<ReviewedFileStoreSubject>,
): void {
  describe(subject, () => {
    let opened: ReviewedFileStoreSubject;
    let store: ReviewedFileStore;

    beforeEach(async () => {
      opened = await openSubject([first, second]);
      store = opened.store;
    });

    afterEach(async () => {
      await opened.close();
    });

    it('lists no marks for a worktree without reviewed files', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: second, marks: [mark('README.md')] }),
      );
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([]);
    });

    it('lists the saved marks of the worktree in path order', async () => {
      await Effect.runPromise(
        store.save({
          worktreeId: first,
          marks: [mark('src/b.ts'), mark('README.md'), mark('src/a.ts')],
        }),
      );
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([mark('README.md'), mark('src/a.ts'), mark('src/b.ts')]);
    });

    it('keeps the marks of each worktree apart', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: first, marks: [mark('README.md', 'first')] }),
      );
      await Effect.runPromise(
        store.save({
          worktreeId: second,
          marks: [mark('README.md', 'second')],
        }),
      );
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([mark('README.md', 'first')]);
    });

    it('replaces the mark of a path saved again and keeps the others', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: first, marks: [mark('a.ts'), mark('b.ts')] }),
      );
      const again = { ...mark('a.ts', 'newer'), stale: true };
      await Effect.runPromise(
        store.save({ worktreeId: first, marks: [again] }),
      );
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([again, mark('b.ts')]);
    });

    it('changes nothing when no marks are saved', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: first, marks: [mark('a.ts')] }),
      );
      await Effect.runPromise(store.save({ worktreeId: first, marks: [] }));
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([mark('a.ts')]);
    });

    it('removes the marks of the asked paths in the asked worktree only', async () => {
      await Effect.runPromise(
        store.save({
          worktreeId: first,
          marks: [mark('a.ts'), mark('b.ts'), mark('c.ts')],
        }),
      );
      await Effect.runPromise(
        store.save({ worktreeId: second, marks: [mark('a.ts')] }),
      );
      await Effect.runPromise(
        store.remove({
          worktreeId: first,
          paths: ['a.ts', 'c.ts', 'unknown.ts'],
        }),
      );
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([mark('b.ts')]);
      expect(
        await Effect.runPromise(store.list({ worktreeId: second })),
      ).toEqual([mark('a.ts')]);
    });

    it('marks the asked paths stale and fresh again, leaving the others', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: first, marks: [mark('a.ts'), mark('b.ts')] }),
      );
      await Effect.runPromise(
        store.save({ worktreeId: second, marks: [mark('a.ts')] }),
      );
      await Effect.runPromise(
        store.setStale({ worktreeId: first, paths: ['a.ts'], stale: true }),
      );
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([{ ...mark('a.ts'), stale: true }, mark('b.ts')]);
      expect(
        await Effect.runPromise(store.list({ worktreeId: second })),
      ).toEqual([mark('a.ts')]);
      await Effect.runPromise(
        store.setStale({ worktreeId: first, paths: ['a.ts'], stale: false }),
      );
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([mark('a.ts'), mark('b.ts')]);
    });

    it('keeps the worktree and branch marks of one path apart', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: first, marks: [mark('a.ts', 'worktree')] }),
      );
      await Effect.runPromise(
        store.save({
          worktreeId: first,
          scope: 'branch',
          marks: [mark('a.ts', 'branch'), mark('b.ts', 'branch')],
        }),
      );
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([mark('a.ts', 'worktree')]);
      expect(
        await Effect.runPromise(
          store.list({ worktreeId: first, scope: 'worktree' }),
        ),
      ).toEqual([mark('a.ts', 'worktree')]);
      expect(
        await Effect.runPromise(
          store.list({ worktreeId: first, scope: 'branch' }),
        ),
      ).toEqual([mark('a.ts', 'branch'), mark('b.ts', 'branch')]);
    });

    it('removes and marks stale only in the asked scope', async () => {
      await Effect.runPromise(
        store.save({ worktreeId: first, marks: [mark('a.ts'), mark('b.ts')] }),
      );
      await Effect.runPromise(
        store.save({
          worktreeId: first,
          scope: 'branch',
          marks: [mark('a.ts'), mark('b.ts')],
        }),
      );
      await Effect.runPromise(
        store.remove({ worktreeId: first, scope: 'branch', paths: ['a.ts'] }),
      );
      await Effect.runPromise(
        store.setStale({ worktreeId: first, paths: ['b.ts'], stale: true }),
      );
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([mark('a.ts'), { ...mark('b.ts'), stale: true }]);
      expect(
        await Effect.runPromise(
          store.list({ worktreeId: first, scope: 'branch' }),
        ),
      ).toEqual([mark('b.ts')]);
    });

    it('keeps the branch marks of each branch apart', async () => {
      await Effect.runPromise(
        store.save({
          worktreeId: first,
          scope: 'branch',
          branch: 'refs/heads/one',
          marks: [mark('a.ts', 'one')],
        }),
      );
      await Effect.runPromise(
        store.save({
          worktreeId: first,
          scope: 'branch',
          branch: 'refs/heads/two',
          marks: [mark('a.ts', 'two'), mark('b.ts', 'two')],
        }),
      );
      await Effect.runPromise(
        store.remove({
          worktreeId: first,
          scope: 'branch',
          branch: 'refs/heads/two',
          paths: ['b.ts'],
        }),
      );
      expect(
        await Effect.runPromise(
          store.list({
            worktreeId: first,
            scope: 'branch',
            branch: 'refs/heads/one',
          }),
        ),
      ).toEqual([mark('a.ts', 'one')]);
      expect(
        await Effect.runPromise(
          store.list({
            worktreeId: first,
            scope: 'branch',
            branch: 'refs/heads/two',
          }),
        ),
      ).toEqual([mark('a.ts', 'two')]);
    });

    it('hands out copies, so changing a returned mark leaves the stored one unchanged', async () => {
      const saved = mark('a.ts');
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
      expect(
        await Effect.runPromise(store.list({ worktreeId: first })),
      ).toEqual([mark('a.ts')]);
    });
  });
}
