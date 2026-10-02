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
