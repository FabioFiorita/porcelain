import { randomBytes } from 'node:crypto';
import type { Application } from './application.ts';
import { applicationSettingsSchema } from './config/application-settings.ts';
import { openDatabase } from './db/connection.ts';
import { CommitCursorCodec } from './git/commit-cursor.ts';
import { CommitGit } from './git/commit-git.ts';
import { Git } from './git/git.ts';
import type { CommitReaderFactory } from './git/interfaces/commit-reader.ts';
import type { GitFactory } from './git/interfaces/git-factory.ts';
import { OperationRunner } from './lifecycle/operation-runner.ts';
import { InventoryRepository } from './repositories/inventory-repository.ts';
import { InspectCommitChanges } from './use-cases/inspect-commit-changes.ts';
import { ListCommits } from './use-cases/list-commits.ts';
import { RefreshProjects } from './use-cases/refresh-projects.ts';
import { RegisterProject } from './use-cases/register-project.ts';

export async function openApplication(options: {
  dataDirectory: string;
  git?: GitFactory;
  commitGit?: CommitReaderFactory;
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
    const git = options.git ?? ((checkout: string) => new Git(checkout));
    const cursor = new CommitCursorCodec(randomBytes(32));
    const commitGit =
      options.commitGit ?? ((checkout) => new CommitGit(checkout, cursor));
    const listCommits = new ListCommits(store, commitGit);
    const inspectCommitChanges = new InspectCommitChanges(store, commitGit);
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
      listCommits: (worktreeId, request, signal) =>
        operations.run(
          (operationSignal) =>
            listCommits.execute(worktreeId, request, operationSignal),
          signal,
        ),
      inspectCommitChanges: (worktreeId, request, signal) =>
        operations.run(
          (operationSignal) =>
            inspectCommitChanges.execute(worktreeId, request, operationSignal),
          signal,
        ),
      close: () => operations.close(),
    };
  } catch (error) {
    await operations.close();
    throw error;
  }
}
