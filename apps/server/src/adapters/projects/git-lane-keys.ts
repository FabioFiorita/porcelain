import type { InventoryStore } from '@porcelain/projects/ports';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { GitProjectWorktreeReader } from './git-project-worktree-reader.ts';

const INVENTORY = 'inventory';
const FILESYSTEM = 'filesystem';
const UNRESOLVED = 'unresolved';

export class GitLaneKeys implements LaneKeys {
  private readonly worktreeDirectory: Pick<
    GitProjectWorktreeReader,
    'repositoryOf'
  >;
  private readonly projectInventory: InventoryStore;

  constructor(
    worktreeDirectory: Pick<GitProjectWorktreeReader, 'repositoryOf'>,
    projectInventory: InventoryStore,
  ) {
    this.worktreeDirectory = worktreeDirectory;
    this.projectInventory = projectInventory;
  }

  inventory(): string {
    return INVENTORY;
  }

  filesystem(): string {
    return FILESYSTEM;
  }

  project(projectId: string): string {
    return (
      this.projectInventory
        .read()
        .projects.find((project) => project.id === projectId)
        ?.repositoryIdentity ?? UNRESOLVED
    );
  }

  worktree(worktreeId: string): string {
    return this.worktreeDirectory.repositoryOf(worktreeId) ?? UNRESOLVED;
  }
}
