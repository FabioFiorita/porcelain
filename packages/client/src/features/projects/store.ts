import { createWriteQueue } from '../../shared/api/write-queue.ts';
import { createStore } from 'zustand/vanilla';
import { ConnectionError } from '../../shared/api/connection-error.ts';
import type {
  ProjectSelectionSnapshot,
  ProjectSelectionStorage,
} from './ports/project-selection-storage.ts';

type ProjectSelectionState = ProjectSelectionSnapshot & {
  status: 'loading' | 'ready' | 'unreadable';
  error: string | undefined;
  load: () => Promise<void>;
  selectEnvironment: (environmentId: string) => Promise<void>;
  selectWorktree: (
    environmentId: string,
    projectId: string,
    worktreeId: string,
  ) => Promise<void>;
  forgetEnvironment: (environmentId: string) => Promise<void>;
};

export function createProjectSelectionStore(storage: ProjectSelectionStorage) {
  return createStore<ProjectSelectionState>()((set, get) => {
    const queue = createWriteQueue();
    function write(
      update: (snapshot: ProjectSelectionSnapshot) => ProjectSelectionSnapshot,
    ) {
      return queue.enqueue(async () => {
        if (get().status !== 'ready')
          throw new ConnectionError(
            'Saved workspace selections must be read before changing them.',
          );
        const snapshot = update(get());
        try {
          await storage.write(snapshot);
          set(snapshot);
        } catch (error) {
          const message =
            'Saved workspace selections could not be updated. Read them again before making changes.';
          set({ status: 'unreadable', error: message });
          throw new ConnectionError(message, { cause: error });
        }
      });
    }
    return {
      currentEnvironmentId: undefined,
      selections: {},
      status: 'loading',
      error: undefined,
      load: () =>
        queue.enqueue(async () => {
          set({ status: 'loading', error: undefined });
          try {
            const snapshot = await storage.read();
            set({ ...snapshot, status: 'ready' });
          } catch {
            set({
              status: 'unreadable',
              error:
                'Saved workspace selections could not be read. Try reading them again.',
            });
          }
        }),
      selectEnvironment: (environmentId) =>
        write(({ selections }) => ({
          currentEnvironmentId: environmentId,
          selections,
        })),
      selectWorktree: (environmentId, projectId, worktreeId) =>
        write(({ currentEnvironmentId, selections }) => {
          if (currentEnvironmentId !== environmentId)
            throw new ConnectionError(
              'The selected environment changed. Open its project picker again.',
            );
          return {
            currentEnvironmentId,
            selections: {
              ...selections,
              [environmentId]: { projectId, worktreeId },
            },
          };
        }),
      forgetEnvironment: (environmentId) =>
        write(({ currentEnvironmentId, selections }) => ({
          currentEnvironmentId:
            currentEnvironmentId === environmentId
              ? undefined
              : currentEnvironmentId,
          selections: Object.fromEntries(
            Object.entries(selections).filter(([id]) => id !== environmentId),
          ),
        })),
    };
  });
}

export type ProjectSelectionStore = ReturnType<
  typeof createProjectSelectionStore
>;
