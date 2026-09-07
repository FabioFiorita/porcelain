import type { GitFactory } from '../git/interfaces/git-factory.ts';
import type { Project } from '../models/project.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { reconcileProject } from './reconciliation/reconcile-project.ts';

async function rediscover(git: GitFactory, project: Project) {
  for (const worktree of project.worktrees) {
    try {
      const candidate = await git(worktree.path).listWorktrees();
      if (candidate.repositoryIdentity === project.repositoryIdentity)
        return candidate;
    } catch {
      // Another known checkout may still provide the repository inventory.
    }
  }
  return undefined;
}

export class RefreshProjects {
  private readonly store: InventoryStore;
  private readonly git: GitFactory;

  constructor(store: InventoryStore, git: GitFactory) {
    this.store = store;
    this.git = git;
  }

  async execute() {
    for (const project of this.store.read().projects) {
      const discovered = await rediscover(this.git, project);
      this.store.save(
        discovered
          ? reconcileProject(discovered, project)
          : {
              ...project,
              available: false,
              worktrees: project.worktrees.map((worktree) => ({
                ...worktree,
                available: false,
              })),
            },
      );
    }
    return this.store.read();
  }
}
