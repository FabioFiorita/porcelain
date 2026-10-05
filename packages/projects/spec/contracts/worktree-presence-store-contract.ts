import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorktreePresence } from '../../src/models/worktree-presence.ts';
import type { WorktreePresenceStore } from '../../src/ports/worktree-presence-store.ts';

export type WorktreePresenceStoreSubject = {
  store: WorktreePresenceStore;
  close: () => Promise<void> | void;
};

function present(worktreeId: string, projectId = 'api'): WorktreePresence {
  return { worktreeId, projectId, missingSince: undefined };
}

function missing(worktreeId: string, projectId = 'api'): WorktreePresence {
  return { worktreeId, projectId, missingSince: '2026-09-01T00:00:00.000Z' };
}

function byWorktree(rows: readonly WorktreePresence[]): WorktreePresence[] {
  return rows.toSorted((left, right) =>
    left.worktreeId.localeCompare(right.worktreeId),
  );
}

export function worktreePresenceStoreContract(
  subject: string,
  openSubject: (
    projectIds: readonly string[],
  ) => WorktreePresenceStoreSubject | Promise<WorktreePresenceStoreSubject>,
): void {
  describe(subject, () => {
    let opened: WorktreePresenceStoreSubject;
    let store: WorktreePresenceStore;

    beforeEach(async () => {
      opened = await openSubject(['api', 'web']);
      store = opened.store;
    });

    afterEach(async () => {
      await opened.close();
    });

    it('lists nothing before any presence is saved', async () => {
      expect(await Effect.runPromise(store.list())).toEqual([]);
      expect(await Effect.runPromise(store.read({ projectId: 'api' }))).toEqual(
        [],
      );
    });

    it('lists every saved worktree with its project and absence', async () => {
      await Effect.runPromise(
        store.save({
          rows: [present('one'), missing('two'), present('three', 'web')],
        }),
      );
      expect(byWorktree(await Effect.runPromise(store.list()))).toEqual([
        present('one'),
        present('three', 'web'),
        missing('two'),
      ]);
    });

    it('reads the worktrees of the asked project only', async () => {
      await Effect.runPromise(
        store.save({
          rows: [present('one'), missing('two'), present('three', 'web')],
        }),
      );
      expect(
        byWorktree(await Effect.runPromise(store.read({ projectId: 'api' }))),
      ).toEqual([present('one'), missing('two')]);
    });

    it('replaces the presence of a worktree saved again and keeps the others', async () => {
      await Effect.runPromise(
        store.save({ rows: [present('one'), present('two')] }),
      );
      await Effect.runPromise(store.save({ rows: [missing('one')] }));
      expect(byWorktree(await Effect.runPromise(store.list()))).toEqual([
        missing('one'),
        present('two'),
      ]);
      await Effect.runPromise(store.save({ rows: [present('one')] }));
      expect(byWorktree(await Effect.runPromise(store.list()))).toEqual([
        present('one'),
        present('two'),
      ]);
    });

    it('changes nothing when no rows are saved', async () => {
      await Effect.runPromise(store.save({ rows: [present('one')] }));
      await Effect.runPromise(store.save({ rows: [] }));
      expect(await Effect.runPromise(store.list())).toEqual([present('one')]);
    });

    it('removes the asked worktrees only', async () => {
      await Effect.runPromise(
        store.save({
          rows: [present('one'), present('two'), present('three')],
        }),
      );
      await Effect.runPromise(
        store.remove({ worktreeIds: ['one', 'three', 'unknown'] }),
      );
      expect(await Effect.runPromise(store.list())).toEqual([present('two')]);
    });

    it('hands out copies, so changing a returned presence leaves the stored one unchanged', async () => {
      const saved = present('one');
      await Effect.runPromise(store.save({ rows: [saved] }));
      saved.missingSince = '2026-09-02T00:00:00.000Z';
      Object.assign((await Effect.runPromise(store.list())).at(0) ?? {}, {
        projectId: 'web',
      });
      Object.assign(
        (await Effect.runPromise(store.read({ projectId: 'api' }))).at(0) ?? {},
        {
          projectId: 'web',
        },
      );
      expect(await Effect.runPromise(store.list())).toEqual([present('one')]);
    });
  });
}
