import { createOperationStore } from '@porcelain/client/git-actions';
import type { Remote } from '@porcelain/client/access/rules';
import { operationStorage } from './adapters/operation-storage';
import { Effect } from 'effect';
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

export function createProjectOperations(
  remote: Pick<Remote, 'environmentId' | 'address' | 'deviceId'>,
) {
  return createOperationStore({
    storage: operationStorage,
    key: JSON.stringify([
      remote.environmentId,
      remote.address,
      remote.deviceId,
    ]),
  });
}
