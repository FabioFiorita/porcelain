import { randomBytes } from 'node:crypto';
import type { Application } from './application.ts';
import { applicationSettingsSchema } from './config/application-settings.ts';
import { openDatabase } from './db/connection.ts';
import { NodeFileReader } from './filesystem/file-reader.ts';
import type { FileReader } from './filesystem/interfaces/file-reader.ts';
import { CommitCursorCodec } from './git/commit-cursor.ts';
import { CommitGit } from './git/commit-git.ts';
import { Git } from './git/git.ts';
import { InspectionGit } from './git/inspection-git.ts';
import type { CommitReaderFactory } from './git/interfaces/commit-reader.ts';
import type { GitFactory } from './git/interfaces/git-factory.ts';
import type { InspectionFactory } from './git/interfaces/inspection-factory.ts';
import { OperationRunner } from './lifecycle/operation-runner.ts';
import { FilePreferenceRepository } from './repositories/file-preference-repository.ts';
import { InventoryRepository } from './repositories/inventory-repository.ts';
import { InspectCommitChanges } from './use-cases/inspect-commit-changes.ts';
import { ListCommits } from './use-cases/list-commits.ts';
import { ListDirectory } from './use-cases/list-directory.ts';
import { ListFilePreferences } from './use-cases/list-file-preferences.ts';
import { ReadTextFile } from './use-cases/read-text-file.ts';
import { ReadWorktreeDiff } from './use-cases/read-worktree-diff.ts';
import { ReadWorktreeStatus } from './use-cases/read-worktree-status.ts';
import { RefreshProjects } from './use-cases/refresh-projects.ts';
import { RegisterProject } from './use-cases/register-project.ts';
import { SetFilePreference } from './use-cases/set-file-preference.ts';

export async function openApplication(options: {
  dataDirectory: string;
  git?: GitFactory;
  commitGit?: CommitReaderFactory;
  inspectionGit?: InspectionFactory;
  files?: FileReader;
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
    const cursor = new CommitCursorCodec(randomBytes(32));
    const commitGit =
      options.commitGit ?? ((checkout) => new CommitGit(checkout, cursor));
    const listCommits = new ListCommits(store, commitGit);
    const inspectCommitChanges = new InspectCommitChanges(store, commitGit);
    const files = options.files ?? new NodeFileReader();
    const list = new ListDirectory(store, git, files);
    const read = new ReadTextFile(store, git, files);
    const refresh = new RefreshProjects(store, git);
    const register = new RegisterProject(store, git, refresh);
    const inspection =
      options.inspectionGit ??
      ((checkout: string, identity: string, repositoryIdentity: string) =>
        new InspectionGit(checkout, identity, repositoryIdentity));
    const status = new ReadWorktreeStatus(store, inspection);
    const diff = new ReadWorktreeDiff(store, inspection);
    await operations.run((signal) => refresh.execute(signal), options.signal);
    return {
      gitStatus: (worktreeId, signal) =>
        operations.run(
          (operationSignal) => status.execute(worktreeId, operationSignal),
          signal,
        ),
      gitDiff: (worktreeId, expectedStatusToken, selection, signal) => {
        const submitted = {
          scope: selection.scope,
          oldPath: selection.oldPath,
          newPath: selection.newPath,
        };
        return operations.run(
          (operationSignal) =>
            diff.execute(
              worktreeId,
              expectedStatusToken,
              submitted,
              operationSignal,
            ),
          signal,
        );
      },
      listDirectory: (id: string, path: string, signal?: AbortSignal) =>
        operations.run(
          (operationSignal) => list.execute(id, path, operationSignal),
          signal,
        ),
      readTextFile: (id: string, path: string, signal?: AbortSignal) =>
        operations.run(
          (operationSignal) => read.execute(id, path, operationSignal),
          signal,
        ),
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
      listCommits: (worktreeId, request, signal) => {
        const submitted = { ...request };
        return operations.run(
          (operationSignal) =>
            listCommits.execute(worktreeId, submitted, operationSignal),
          signal,
        );
      },
      inspectCommitChanges: (worktreeId, request, signal) => {
        const submitted = { ...request };
        return operations.run(
          (operationSignal) =>
            inspectCommitChanges.execute(
              worktreeId,
              submitted,
              operationSignal,
            ),
          signal,
        );
      },
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
