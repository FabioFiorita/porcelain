import type { DiscoveryIssue } from '../git/dtos/discovery-issue.ts';
import type { GitFactory } from '../git/interfaces/git-factory.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { reconcileProject } from './reconciliation/reconcile-project.ts';
import type { RefreshProjects } from './refresh-projects.ts';

export class RegisterProject {
  private readonly store: InventoryStore;
  private readonly git: GitFactory;
  private readonly refresh: Pick<RefreshProjects, 'execute'>;

  constructor(
    store: InventoryStore,
    git: GitFactory,
    refresh: Pick<RefreshProjects, 'execute'>,
  ) {
    this.store = store;
    this.git = git;
    this.refresh = refresh;
  }

  async execute(
    checkout: string,
    signal?: AbortSignal,
    reportIssue: (issue: DiscoveryIssue) => void = () => {},
  ) {
    const discovered = await this.git(checkout).listWorktrees(
      signal,
      reportIssue,
    );
    signal?.throwIfAborted();
    // Only revisit old projects whose recorded checkout paths overlap this registration.
    const paths = new Set(
      discovered.worktrees.map((worktree) => worktree.path),
    );
    const conflicts = this.store
      .read()
      .projects.filter(
        (project) =>
          project.repositoryIdentity !== discovered.repositoryIdentity &&
          project.worktrees.some((worktree) => paths.has(worktree.path)),
      );
    if (conflicts.length > 0)
      await this.refresh.execute(
        signal,
        reportIssue,
        conflicts.map((project) => project.id),
      );
    signal?.throwIfAborted();
    const previous = this.store
      .read()
      .projects.find(
        (project) =>
          project.repositoryIdentity === discovered.repositoryIdentity,
      );
    const project = reconcileProject(discovered, previous);
    this.store.save(project);
    return project;
  }
}
