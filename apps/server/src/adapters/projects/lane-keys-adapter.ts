import type { InventoryStore } from '@porcelain/projects/ports';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { WorktreeDirectoryAdapter } from './worktree-directory-adapter.ts';

const INVENTORY = 'inventory';
const FILESYSTEM = 'filesystem';
const UNRESOLVED = 'unresolved';

export class LaneKeysAdapter implements LaneKeys {
  private readonly worktreeDirectory: Pick<
    WorktreeDirectoryAdapter,
    'repositoryOf'
  >;
  private readonly inventoryStore: InventoryStore;

  constructor(
    worktreeDirectory: Pick<WorktreeDirectoryAdapter, 'repositoryOf'>,
    inventoryStore: InventoryStore,
  ) {
    this.worktreeDirectory = worktreeDirectory;
    this.inventoryStore = inventoryStore;
  }

  inventory(): string {
    return INVENTORY;
  }

  filesystem(): string {
    return FILESYSTEM;
  }

  project(projectId: string): string {
    return (
      this.inventoryStore
        .read()
        .projects.find((project) => project.id === projectId)
        ?.repositoryIdentity ?? UNRESOLVED
    );
  }

  worktree(worktreeId: string): string {
    return this.worktreeDirectory.repositoryOf(worktreeId) ?? UNRESOLVED;
  }
}
