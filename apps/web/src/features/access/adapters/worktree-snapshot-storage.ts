import { Effect } from 'effect';
import { WorktreeSnapshotStorage } from '@porcelain/client/projects';

const key = (environmentId: string) =>
  `porcelain.worktree-snapshot:${environmentId}`;

export const worktreeSnapshotStorage = WorktreeSnapshotStorage.of({
  read: (environmentId) =>
    Effect.try(() => localStorage.getItem(key(environmentId))),
  write: (environmentId, snapshot) =>
    Effect.try(() => localStorage.setItem(key(environmentId), snapshot)),
  remove: (environmentId) =>
    Effect.try(() => localStorage.removeItem(key(environmentId))),
});
