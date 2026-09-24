import type { Worktree } from '@porcelain/kernel/models';
import type { WorktreeCatalogStore } from '@porcelain/projects/ports';
import type { LaneKeys } from '../../runtime/lane-keys.ts';

const ACCESS = 'access';
const INVENTORY = 'inventory';
const FILESYSTEM = 'filesystem';

export class GitLaneKeys implements LaneKeys {
  private readonly catalog: WorktreeCatalogStore;

  constructor(catalog: WorktreeCatalogStore) {
    this.catalog = catalog;
  }

  access(): string {
    return ACCESS;
  }

  inventory(): string {
    return INVENTORY;
  }

  filesystem(): string {
    return FILESYSTEM;
  }

  project(projectId: string): string {
    return (
      this.catalog.observations().find((project) => project.id === projectId)
        ?.repositoryIdentity ?? `project\0${projectId}`
    );
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
