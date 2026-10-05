import { createOperationStore } from '@porcelain/client/git-actions';
import type { Remote } from '@porcelain/client/access/rules';
import { operationStorage } from './adapters/operation-storage';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  createProjectSelectionStore,
  type ProjectSelectionStore,
} from '@porcelain/client/projects';
import { projectSelectionStorage } from './adapters/selection-storage';

export const projectSelectionStore: ProjectSelectionStore =
  createProjectSelectionStore(projectSelectionStorage);

export function useProjectSelection() {
  return useStore(
    projectSelectionStore,
    useShallow((state) => ({
      currentEnvironmentId: state.currentEnvironmentId,
      selections: state.selections,
      status: state.status,
      error: state.error,
    })),
  );
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
