import { applicationSettingsSchema } from './config/application-settings.ts';
import { openDatabase } from './db/connection.ts';
import type { DiscoveryIssue } from './git/dtos/discovery-issue.ts';
import { Git } from './git/git.ts';
import type { GitFactory } from './git/interfaces/git-factory.ts';
import { OperationRunner } from './lifecycle/operation-runner.ts';
import { InventoryRepository } from './repositories/inventory-repository.ts';
import { RefreshProjects } from './use-cases/refresh-projects.ts';
import { RegisterProject } from './use-cases/register-project.ts';

export async function openApplication(options: {
  dataDirectory: string;
  git?: GitFactory;
  signal?: AbortSignal;
  operationTimeoutMs?: number;
}) {
  const { operationTimeoutMs } = applicationSettingsSchema.parse(options);
  options.signal?.throwIfAborted();
  const database = openDatabase(options.dataDirectory);
  const operations = new OperationRunner(
    () => database.close(),
    operationTimeoutMs,
  );
  let issues: DiscoveryIssue[] = [];
  const reportIssue = (issue: DiscoveryIssue) => issues.push(issue);
  try {
    const store = new InventoryRepository(database.db);
    const git = options.git ?? ((checkout: string) => new Git(checkout));
    const refresh = new RefreshProjects(store, git);
    const register = new RegisterProject(store, git, refresh);
    await operations.run(
      (signal) => refresh.execute(signal, reportIssue),
      options.signal,
    );
    return {
      inventory: () => {
        operations.assertOpen();
        return store.read();
      },
      discoveryIssues: () => [...issues],
      register: (checkout: string, signal?: AbortSignal) =>
        operations.run((operationSignal) => {
          issues = [];
          return register.execute(checkout, operationSignal, reportIssue);
        }, signal),
      refresh: (signal?: AbortSignal) =>
        operations.run((operationSignal) => {
          issues = [];
          return refresh.execute(operationSignal, reportIssue);
        }, signal),
      close: () => operations.close(),
    };
  } catch (error) {
    await operations.close();
    throw error;
  }
}
