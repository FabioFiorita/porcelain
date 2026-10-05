import { Effect } from 'effect';
import {
  createWriteQueue,
  type WriteNotSentError,
} from '../../shared/api/write-queue.ts';
import { createStore } from 'zustand/vanilla';
import { ConnectionError } from '../../shared/api/connection-error.ts';
import type {
  ProjectSelectionSnapshot,
  ProjectSelectionStorage,
} from './ports/project-selection-storage.ts';

type ProjectSelectionState = ProjectSelectionSnapshot & {
  status: 'loading' | 'ready' | 'unreadable';
  error: string | undefined;
  load: () => Effect.Effect<void, ConnectionError | WriteNotSentError>;
  selectEnvironment: (
    environmentId: string,
  ) => Effect.Effect<void, ConnectionError | WriteNotSentError>;
  selectWorktree: (
    environmentId: string,
    projectId: string,
    worktreeId: string,
  ) => Effect.Effect<void, ConnectionError | WriteNotSentError>;
  forgetEnvironment: (
    environmentId: string,
  ) => Effect.Effect<void, ConnectionError | WriteNotSentError>;
};

export function createProjectSelectionStore(storage: ProjectSelectionStorage) {
  return createStore<ProjectSelectionState>()((set, get) => {
    const queue = createWriteQueue();
    function write(
      update: (snapshot: ProjectSelectionSnapshot) => ProjectSelectionSnapshot,
    ) {
      return queue.enqueue(
        Effect.gen(function* () {
          if (get().status !== 'ready')
            return yield* Effect.fail(
              new ConnectionError({
                message:
                  'Saved workspace selections must be read before changing them.',
              }),
            );
          const snapshot = yield* Effect.suspend(() => {
            try {
              return Effect.succeed(update(get()));
            } catch (error) {
              return error instanceof ConnectionError
                ? Effect.fail(error)
                : Effect.die(error);
            }
          });
          const message =
            'Saved workspace selections could not be updated. Read them again before making changes.';
          yield* Effect.tryPromise({
            try: () => storage.write(snapshot),
            catch: (cause) => new ConnectionError({ message: message, cause }),
          }).pipe(
            Effect.tapError(() =>
              Effect.sync(() => set({ status: 'unreadable', error: message })),
            ),
          );
          set(snapshot);
        }),
      );
    }
    return {
      currentEnvironmentId: undefined,
      selections: {},
      status: 'loading',
      error: undefined,
      load: () =>
        queue.enqueue(
          Effect.gen(function* () {
            set({ status: 'loading', error: undefined });
            yield* Effect.tryPromise({
              try: () => storage.read(),
              catch: (cause) =>
                new ConnectionError({
                  message:
                    'Saved workspace selections could not be read. Try reading them again.',
                  cause,
                }),
            }).pipe(
              Effect.matchEffect({
                onSuccess: (snapshot) =>
                  Effect.sync(() => set({ ...snapshot, status: 'ready' })),
                onFailure: (error) =>
                  Effect.sync(() =>
                    set({ status: 'unreadable', error: error.message }),
                  ),
              }),
            );
          }),
        ),
      selectEnvironment: (environmentId) =>
        write(({ selections }) => ({
          currentEnvironmentId: environmentId,
          selections,
        })),
      selectWorktree: (environmentId, projectId, worktreeId) =>
        write(({ currentEnvironmentId, selections }) => {
          if (currentEnvironmentId !== environmentId)
            throw new ConnectionError({
              message:
                'The selected environment changed. Open its project picker again.',
            });
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
