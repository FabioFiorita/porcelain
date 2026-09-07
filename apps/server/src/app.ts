import { openDatabase } from './db/connection.ts';
import { createGitInventory } from './git/discover-worktrees.ts';
import { createInventoryRepository } from './repositories/inventory-repository.ts';
import type { GitInventory } from './use-cases/projects/inventory.ts';
import { refreshProjects } from './use-cases/projects/refresh-projects.ts';
import { registerProject } from './use-cases/projects/register-project.ts';

export async function openApplication(options: {
  dataDirectory: string;
  git?: GitInventory;
}) {
  const database = openDatabase(options.dataDirectory);
  try {
    const store = createInventoryRepository(database.db);
    const git = options.git ?? createGitInventory();
    // Serialize writes and shutdown so discovery cannot overwrite newer inventory.
    let pending: Promise<unknown> = Promise.resolve();
    function serialize<T>(operation: () => Promise<T>): Promise<T> {
      const result = pending.then(operation);
      pending = result.catch(() => undefined);
      return result;
    }
    await refreshProjects(store, git);
    return {
      inventory: () => store.read(),
      register: (checkout: string) =>
        serialize(() => registerProject(store, git, checkout)),
      refresh: () => serialize(() => refreshProjects(store, git)),
      close: () =>
        serialize(async () => {
          database.close();
        }),
    };
  } catch (error) {
    database.close();
    throw error;
  }
}
