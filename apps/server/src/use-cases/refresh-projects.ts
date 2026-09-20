import type { DiscoveryIssue } from '@porcelain/git/dtos/discovery-issue';
import { isRepositoryUnavailable } from '@porcelain/git/errors/is-repository-unavailable';
import { RepositoryIdentityMismatchError } from '@porcelain/git/errors/repository-identity-mismatch-error';
import type { GitFactory } from '@porcelain/git/interfaces/git-factory';
import type { Project } from '../models/project.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { reconcileProject } from './reconciliation/reconcile-project.ts';

async function rediscover(
  git: GitFactory,
  project: Project,
  signal: AbortSignal | undefined,
) {
  const issues: DiscoveryIssue[] = [];
  for (const worktree of project.worktrees) {
    try {
      const { repository: candidate, issues: discoveredIssues } = await git(
        worktree.path,
      ).listWorktrees(signal);
      issues.push(...discoveredIssues);
      if (candidate.repositoryIdentity === project.repositoryIdentity)
        return { repository: candidate, issues };
      issues.push({
        path: worktree.path,
        error: new RepositoryIdentityMismatchError(),
      });
    } catch (error) {
      signal?.throwIfAborted();
      if (!isRepositoryUnavailable(error)) throw error;
      issues.push({ path: worktree.path, error });
    }
  }
  return { repository: undefined, issues };
}

/** How long one repository may take before it is called unavailable. */
const PER_PROJECT_MS = 10_000;

export class RefreshProjects {
  private readonly store: InventoryStore;
  private readonly git: GitFactory;

  private readonly perProjectMs: number;

  constructor(
    store: InventoryStore,
    git: GitFactory,
    perProjectMs = PER_PROJECT_MS,
  ) {
    this.store = store;
    this.git = git;
    this.perProjectMs = perProjectMs;
  }

  async execute(signal?: AbortSignal, projectIds?: readonly string[]) {
    const issues: DiscoveryIssue[] = [];
    for (const project of this.store.read().projects) {
      if (projectIds && !projectIds.includes(project.id)) continue;
      signal?.throwIfAborted();
      // Each repository gets its own budget, so one on a hung mount cannot
      // spend the whole refresh and stop later ones being attempted.
      const budget = AbortSignal.any([
        ...(signal ? [signal] : []),
        AbortSignal.timeout(this.perProjectMs),
      ]);
      const result = await rediscover(this.git, project, budget).catch(
        (cause: unknown) => {
          signal?.throwIfAborted();
          if (!budget.aborted) throw cause;
          // A repository that did not answer in time is unavailable, which is
          // data the inventory already knows how to carry.
          return { repository: undefined, issues: [] };
        },
      );
      issues.push(...result.issues);
      const discovered = result.repository;
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
    return { inventory: this.store.read(), issues };
  }
}
