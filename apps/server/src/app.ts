import type { Application } from './application.ts';
import { applicationSettingsSchema } from './config/application-settings.ts';
import { openDatabase } from './db/connection.ts';
import { Git } from './git/git.ts';
import type { GitFactory } from './git/interfaces/git-factory.ts';
import { OperationRunner } from './lifecycle/operation-runner.ts';
import { ArtifactRepository } from './repositories/artifact-repository.ts';
import { InventoryRepository } from './repositories/inventory-repository.ts';
import { DeleteArtifact } from './use-cases/delete-artifact.ts';
import { GetArtifact } from './use-cases/get-artifact.ts';
import { ListArtifacts } from './use-cases/list-artifacts.ts';
import { RefreshProjects } from './use-cases/refresh-projects.ts';
import { RegisterProject } from './use-cases/register-project.ts';
import { UploadArtifact } from './use-cases/upload-artifact.ts';

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
    const artifacts = new ArtifactRepository(database.db);
    const uploadArtifact = new UploadArtifact(artifacts, store);
    const listArtifacts = new ListArtifacts(artifacts, store);
    const getArtifact = new GetArtifact(artifacts, store);
    const deleteArtifact = new DeleteArtifact(artifacts, store);
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
      uploadArtifact: (worktreeId, input, signal) =>
        operations.run(
          async () => uploadArtifact.execute(worktreeId, input),
          signal,
        ),
      listArtifacts: (worktreeId, signal) =>
        operations.run(async () => listArtifacts.execute(worktreeId), signal),
      getArtifact: (worktreeId, artifactId, signal) =>
        operations.run(
          async () => getArtifact.execute(worktreeId, artifactId),
          signal,
        ),
      deleteArtifact: (worktreeId, artifactId, signal) =>
        operations.run(
          async () => deleteArtifact.execute(worktreeId, artifactId),
          signal,
        ),
      close: () => operations.close(),
    };
  } catch (error) {
    await operations.close();
    throw error;
  }
}
