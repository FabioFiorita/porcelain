import { Context, Effect, Layer } from 'effect';
import { type Worktree } from '@porcelain/kernel/models';
import { type ListableProject } from '@porcelain/projects/models';

const ACCESS = 'access';
const REMOTE_ACCESS = 'remote-access';
const SERVICE_UPDATE = 'service-update';
const INVENTORY = 'inventory';
const FILESYSTEM = 'filesystem';

export class LaneKeys extends Context.Service<
  LaneKeys,
  {
    readonly access: () => string;
    readonly remoteAccess: () => string;
    readonly serviceUpdate: () => string;
    readonly inventory: () => string;
    readonly filesystem: () => string;
    readonly project: (project: ListableProject) => string;
    readonly repository: (worktree: Worktree) => string;
    readonly receipts: (worktree: Worktree) => string;
    readonly reviews: (worktree: Worktree) => string;
  }
>()('@porcelain/server/LaneKeys') {
  static readonly layer = Layer.effect(
    LaneKeys,
    Effect.sync(() => {
      function access(): string {
        return ACCESS;
      }
      function remoteAccess(): string {
        return REMOTE_ACCESS;
      }
      function serviceUpdate(): string {
        return SERVICE_UPDATE;
      }
      function inventory(): string {
        return INVENTORY;
      }
      function filesystem(): string {
        return FILESYSTEM;
      }
      function project(project: ListableProject): string {
        return project.repositoryIdentity;
      }
      function repository(worktree: Worktree): string {
        return worktree.repositoryId;
      }
      function receipts(worktree: Worktree): string {
        return repository(worktree);
      }
      function reviews(worktree: Worktree): string {
        return repository(worktree);
      }
      return {
        access,
        remoteAccess,
        serviceUpdate,
        inventory,
        filesystem,
        project,
        repository,
        receipts,
        reviews,
      };
    }),
  );
}
