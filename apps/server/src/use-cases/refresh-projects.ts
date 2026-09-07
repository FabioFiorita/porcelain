import type { DiscoveryIssue } from '../git/dtos/discovery-issue.ts';
import { isRepositoryUnavailable } from '../git/errors/is-repository-unavailable.ts';
import type { GitFactory } from '../git/interfaces/git-factory.ts';
import type { Project } from '../models/project.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { reconcileProject } from './reconciliation/reconcile-project.ts';

async function rediscover(
  git: GitFactory,
  project: Project,
  signal: AbortSignal | undefined,
  reportIssue: (issue: DiscoveryIssue) => void,
) {
  for (const worktree of project.worktrees) {
    try {
      const candidate = await git(worktree.path).listWorktrees(
        signal,
        reportIssue,
      );
      if (candidate.repositoryIdentity === project.repositoryIdentity)
        return candidate;
    } catch (error) {
      signal?.throwIfAborted();
      if (!isRepositoryUnavailable(error)) throw error;
      reportIssue({ path: worktree.path, error });
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

  async execute(
    signal?: AbortSignal,
    reportIssue: (issue: DiscoveryIssue) => void = () => {},
    projectIds?: readonly string[],
  ) {
    for (const project of this.store.read().projects) {
      if (projectIds && !projectIds.includes(project.id)) continue;
      signal?.throwIfAborted();
      const discovered = await rediscover(
        this.git,
        project,
        signal,
        reportIssue,
      );
      signal?.throwIfAborted();
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
