import type { GitFactory } from '../../git/worktree-inventory.ts';
import type { InventoryStore } from '../../repositories/inventory-repository.ts';
import { reconcileProject } from './reconcile-project.ts';
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

  async execute(checkout: string) {
    await this.refresh.execute();
    const discovered = await this.git(checkout).listWorktrees();
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
