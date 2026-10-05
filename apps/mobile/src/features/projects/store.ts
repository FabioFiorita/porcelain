import { Effect, Layer } from 'effect';
import {
  OperationStore,
  OperationStorage,
} from '@porcelain/client/git-actions';
import type { Remote } from '@porcelain/client/access/rules';
import { operationStorage } from './adapters/operation-storage';
import { useAtomRef } from '@effect/atom-react';
import {
  ProjectSelectionStore,
  ProjectSelectionStorage,
} from '@porcelain/client/projects';
import { projectSelectionStorage } from './adapters/selection-storage';

export const projectSelectionStore = Effect.runSync(
  ProjectSelectionStore.pipe(
    Effect.provide(ProjectSelectionStore.layer),
    Effect.provideService(ProjectSelectionStorage, projectSelectionStorage),
  ),
);

export function useProjectSelection() {
  return useAtomRef(projectSelectionStore.state);
}

export function projectOperationsLayer(
  remote: Pick<Remote, 'environmentId' | 'address' | 'deviceId'>,
) {
  return OperationStore.layer.pipe(
    Layer.provide(
      Layer.succeed(
        OperationStorage,
        operationStorage(
          JSON.stringify([
            remote.environmentId,
            remote.address,
            remote.deviceId,
          ]),
        ),
      ),
    ),
  );
}
