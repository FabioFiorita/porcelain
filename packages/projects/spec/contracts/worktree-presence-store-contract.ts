import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorktreePresence } from '../../src/models/worktree-presence.ts';
import type { WorktreePresenceStore } from '../../src/ports/worktree-presence-store.ts';

export type WorktreePresenceStoreSubject = {
  store: WorktreePresenceStore;
  close: () => void;
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
  openSubject: (projectIds: readonly string[]) => WorktreePresenceStoreSubject,
): void {
  describe(subject, () => {
    let opened: WorktreePresenceStoreSubject;
    let store: WorktreePresenceStore;

    beforeEach(() => {
      opened = openSubject(['api', 'web']);
      store = opened.store;
    });

    afterEach(() => {
      opened.close();
    });

    it('lists nothing before any presence is saved', () => {
      expect(store.list()).toEqual([]);
      expect(store.read({ projectId: 'api' })).toEqual([]);
    });

    it('lists every saved worktree with its project and absence', () => {
      store.save({
        rows: [present('one'), missing('two'), present('three', 'web')],
      });
      expect(byWorktree(store.list())).toEqual([
        present('one'),
        present('three', 'web'),
        missing('two'),
      ]);
    });

    it('reads the worktrees of the asked project only', () => {
      store.save({
        rows: [present('one'), missing('two'), present('three', 'web')],
      });
      expect(byWorktree(store.read({ projectId: 'api' }))).toEqual([
        present('one'),
        missing('two'),
      ]);
    });

    it('replaces the presence of a worktree saved again and keeps the others', () => {
      store.save({ rows: [present('one'), present('two')] });
      store.save({ rows: [missing('one')] });
      expect(byWorktree(store.list())).toEqual([
        missing('one'),
        present('two'),
      ]);
      store.save({ rows: [present('one')] });
      expect(byWorktree(store.list())).toEqual([
        present('one'),
        present('two'),
      ]);
    });

    it('changes nothing when no rows are saved', () => {
      store.save({ rows: [present('one')] });
      store.save({ rows: [] });
      expect(store.list()).toEqual([present('one')]);
    });

    it('removes the asked worktrees only', () => {
      store.save({ rows: [present('one'), present('two'), present('three')] });
      store.remove({ worktreeIds: ['one', 'three', 'unknown'] });
      expect(store.list()).toEqual([present('two')]);
    });

    it('hands out copies, so changing a returned presence leaves the stored one unchanged', () => {
      const saved = present('one');
      store.save({ rows: [saved] });
      saved.missingSince = '2026-09-02T00:00:00.000Z';
      Object.assign(store.list().at(0) ?? {}, { projectId: 'web' });
      Object.assign(store.read({ projectId: 'api' }).at(0) ?? {}, {
        projectId: 'web',
      });
      expect(store.list()).toEqual([present('one')]);
    });
  });
}
