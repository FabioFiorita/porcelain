import { openDatabase } from './db/connection.ts';
import { Git } from './git/git.ts';
import type { GitFactory } from './git/interfaces/git-factory.ts';
import { InventoryRepository } from './repositories/inventory-repository.ts';
import { RefreshProjects } from './use-cases/refresh-projects.ts';
import { RegisterProject } from './use-cases/register-project.ts';

export async function openApplication(options: {
  dataDirectory: string;
  git?: GitFactory;
}) {
  const database = openDatabase(options.dataDirectory);
  try {
    const store = new InventoryRepository(database.db);
    const git = options.git ?? ((checkout: string) => new Git(checkout));
    const refresh = new RefreshProjects(store, git);
    const register = new RegisterProject(store, git, refresh);
    // Serialize writes and shutdown so discovery cannot overwrite newer inventory.
    let pending: Promise<unknown> = Promise.resolve();
    function serialize<T>(operation: () => Promise<T>): Promise<T> {
      const result = pending.then(operation);
      pending = result.catch(() => undefined);
      return result;
    }
    await refresh.execute();
    return {
      inventory: () => store.read(),
      register: (checkout: string) =>
        serialize(() => register.execute(checkout)),
      refresh: () => serialize(() => refresh.execute()),
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
