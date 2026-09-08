import {
  replaceReviewLayersSchema,
  reviewLayerParamsSchema,
} from '@porcelain/contracts/review-layers';
import type { Application } from './application.ts';
import { applicationSettingsSchema } from './config/application-settings.ts';
import { openDatabase } from './db/connection.ts';
import { Git } from './git/git.ts';
import type { GitFactory } from './git/interfaces/git-factory.ts';
import { OperationRunner } from './lifecycle/operation-runner.ts';
import { InventoryRepository } from './repositories/inventory-repository.ts';
import { ReviewLayerRepository } from './repositories/review-layer-repository.ts';
import { RefreshProjects } from './use-cases/refresh-projects.ts';
import { RegisterProject } from './use-cases/register-project.ts';
import { ReplaceReviewLayers } from './use-cases/replace-review-layers.ts';

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
    const layers = new ReviewLayerRepository(database.db);
    const replaceLayers = new ReplaceReviewLayers(layers);
    const store = new InventoryRepository(database.db);
    const git = options.git ?? ((checkout: string) => new Git(checkout));
    const refresh = new RefreshProjects(store, git);
    const register = new RegisterProject(store, git, refresh);
    await operations.run((signal) => refresh.execute(signal), options.signal);
    return {
      reviewLayers: (worktreeId) => {
        operations.assertOpen();
        return layers.read(
          reviewLayerParamsSchema.parse({ worktreeId }).worktreeId,
        );
      },
      replaceReviewLayers: async (worktreeId, revision, value) => {
        const params = reviewLayerParamsSchema.parse({ worktreeId });
        const input = replaceReviewLayersSchema.parse({
          expectedRevision: revision,
          layers: value,
        });
        return operations.run(async () =>
          replaceLayers.execute(
            params.worktreeId,
            input.expectedRevision,
            input.layers,
          ),
        );
      },
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
      close: () => operations.close(),
    };
  } catch (error) {
    await operations.close();
    throw error;
  }
}
