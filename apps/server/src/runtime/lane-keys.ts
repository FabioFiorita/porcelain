import type { Worktree } from '@porcelain/kernel/models';
import type { ListableProject } from '@porcelain/projects/models';

const ACCESS = 'access';
const REMOTE_ACCESS = 'remote-access';
const SERVICE_UPDATE = 'service-update';
const INVENTORY = 'inventory';
const FILESYSTEM = 'filesystem';

export class LaneKeys {
  access(): string {
    return ACCESS;
  }

  remoteAccess(): string {
    return REMOTE_ACCESS;
  }

  serviceUpdate(): string {
    return SERVICE_UPDATE;
  }

  inventory(): string {
    return INVENTORY;
  }

  filesystem(): string {
    return FILESYSTEM;
  }

  project(project: ListableProject): string {
    return project.repositoryIdentity;
  }

  repository(worktree: Worktree): string {
    return worktree.repositoryId;
  }

  receipts(worktree: Worktree): string {
    return this.repository(worktree);
  }

  reviews(worktree: Worktree): string {
    return this.repository(worktree);
  }
}
