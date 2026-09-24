import type { Worktree } from '@porcelain/kernel/models';
import type { ListableProject } from '@porcelain/projects/models';

const ACCESS = 'access';
const INVENTORY = 'inventory';
const FILESYSTEM = 'filesystem';

export class LaneKeys {
  access(): string {
    return ACCESS;
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
