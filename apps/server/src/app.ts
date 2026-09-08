import type { Application } from './application.ts';
import { applicationSettingsSchema } from './config/application-settings.ts';
import { openDatabase } from './db/connection.ts';
import { Git } from './git/git.ts';
import type { GitFactory } from './git/interfaces/git-factory.ts';
import { OperationRunner } from './lifecycle/operation-runner.ts';
import { FilePreferenceRepository } from './repositories/file-preference-repository.ts';
import { InventoryRepository } from './repositories/inventory-repository.ts';
import { ListFilePreferences } from './use-cases/list-file-preferences.ts';
import { RefreshProjects } from './use-cases/refresh-projects.ts';
import { RegisterProject } from './use-cases/register-project.ts';
import { SetFilePreference } from './use-cases/set-file-preference.ts';

export async function openApplication(options: {
  dataDirectory: string;
  git?: GitFactory;
  signal?: AbortSignal;
  operationTimeoutMs?: number;
}): Promise<Application> {
  const { operationTimeoutMs } = applicationSettingsSchema.parse(options);
  options.signal?.throwIfAborted();
  const database = openDatabase(options.dataDirectory);
  const operations = new OperationRunner(
    () => database.close(),
    operationTimeoutMs,
  );
  try {
    const store = new InventoryRepository(database.db);
    const preferences = new FilePreferenceRepository(database.db);
    const listPreferences = new ListFilePreferences(store, preferences);
    const setPreference = new SetFilePreference(store, preferences);
    const git = options.git ?? ((checkout: string) => new Git(checkout));
    const refresh = new RefreshProjects(store, git);
    const register = new RegisterProject(store, git, refresh);
    await operations.run((signal) => refresh.execute(signal), options.signal);
    return {
      inventory: () => {
        operations.assertOpen();
        return store.read();
      },
      register: (checkout: string, signal?: AbortSignal) =>
        operations.run((operationSignal) => {
          return register.execute(checkout, operationSignal);
        }, signal),
      refresh: (signal?: AbortSignal) =>
        operations.run((operationSignal) => {
          return refresh.execute(operationSignal);
        }, signal),
      listFilePreferences: (worktreeId, signal) =>
        operations.run(async () => listPreferences.execute(worktreeId), signal),
      setFilePreference: (worktreeId, change, signal) => {
        const intent = {
          path: change.path,
          flag: change.flag,
          value: change.value,
        };
        return operations.run(
          async () => setPreference.execute(worktreeId, intent),
          signal,
        );
      },
      close: () => operations.close(),
    };
  } catch (error) {
    await operations.close();
    throw error;
  }
}
