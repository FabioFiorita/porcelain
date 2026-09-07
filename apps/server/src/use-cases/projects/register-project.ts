import type { GitInventory, InventoryRepository } from './inventory.ts';
import { reconcileProject } from './reconcile-project.ts';
import { refreshProjects } from './refresh-projects.ts';

export async function registerProject(
  store: InventoryRepository,
  git: GitInventory,
  checkout: string,
) {
  await refreshProjects(store, git);
  const discovered = await git.discover(checkout);
  const previous = store
    .read()
    .projects.find(
      (project) => project.repositoryIdentity === discovered.repositoryIdentity,
    );
  const project = reconcileProject(discovered, previous);
  store.save(project);
  return project;
}
