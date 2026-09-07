import type {
  GitInventory,
  InventoryRepository,
  Project,
} from './inventory.ts';
import { reconcileProject } from './reconcile-project.ts';

async function rediscover(git: GitInventory, project: Project) {
  for (const worktree of project.worktrees) {
    try {
      const candidate = await git.discover(worktree.path);
      if (candidate.repositoryIdentity === project.repositoryIdentity)
        return candidate;
    } catch {
      // Another known checkout may still provide the repository inventory.
    }
  }
  return undefined;
}

export async function refreshProjects(
  store: InventoryRepository,
  git: GitInventory,
) {
  for (const project of store.read().projects) {
    const discovered = await rediscover(git, project);
    store.save(
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
  return store.read();
}
