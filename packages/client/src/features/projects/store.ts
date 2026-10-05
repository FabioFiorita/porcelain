import { Context, Effect, Layer } from 'effect';
import { AtomRef } from 'effect/reactivity';
import {
  createWriteQueue,
  type WriteNotSentError,
} from '../../shared/api/write-queue.ts';
import { ConnectionError } from '../../shared/api/connection-error.ts';
import {
  ProjectSelectionStorage,
  type ProjectSelectionSnapshot,
} from './ports/project-selection-storage.ts';

type ProjectSelectionState = ProjectSelectionSnapshot & {
  readonly status: 'loading' | 'ready' | 'unreadable';
  readonly error: string | undefined;
};

type WriteFailure = ConnectionError | WriteNotSentError;

export class ProjectSelectionStore extends Context.Service<
  ProjectSelectionStore,
  {
    readonly state: AtomRef.ReadonlyRef<ProjectSelectionState>;
    readonly load: () => Effect.Effect<void, WriteFailure>;
    readonly selectEnvironment: (
      environmentId: string,
    ) => Effect.Effect<void, WriteFailure>;
    readonly selectWorktree: (
      environmentId: string,
      projectId: string,
      worktreeId: string,
    ) => Effect.Effect<void, WriteFailure>;
    readonly forgetEnvironment: (
      environmentId: string,
    ) => Effect.Effect<void, WriteFailure>;
  }
>()('@porcelain/client/ProjectSelectionStore') {
  static readonly layer = Layer.effect(
    ProjectSelectionStore,
    Effect.gen(function* () {
      const storage = yield* ProjectSelectionStorage;
      const state = AtomRef.make<ProjectSelectionState>({
        currentEnvironmentId: undefined,
        selections: {},
        status: 'loading',
        error: undefined,
      });
      const queue = createWriteQueue();
      const write = Effect.fn('ProjectSelectionStore.write')(function* (
        update: (
          snapshot: ProjectSelectionSnapshot,
        ) => Effect.Effect<ProjectSelectionSnapshot, ConnectionError>,
      ) {
        yield* queue.enqueue(
          Effect.gen(function* () {
            if (state.value.status !== 'ready')
              return yield* Effect.fail(
                new ConnectionError({
                  message:
                    'Saved workspace selections must be read before changing them.',
                }),
              );
            const snapshot = yield* update(state.value);
            const message =
              'Saved workspace selections could not be updated. Read them again before making changes.';
            yield* storage.write(snapshot).pipe(
              Effect.mapError(
                ({ cause }) => new ConnectionError({ message, cause }),
              ),
              Effect.tapError(() =>
                Effect.sync(() =>
                  state.update((current) => ({
                    ...current,
                    status: 'unreadable',
                    error: message,
                  })),
                ),
              ),
              Effect.tap(() =>
                Effect.sync(() =>
                  state.update((current) => ({ ...current, ...snapshot })),
                ),
              ),
              Effect.uninterruptible,
            );
          }),
        );
      });
      return {
        state,
        load: Effect.fn('ProjectSelectionStore.load')(function* () {
          yield* queue.enqueue(
            Effect.gen(function* () {
              state.update((current) => ({
                ...current,
                status: 'loading',
                error: undefined,
              }));
              yield* storage.read().pipe(
                Effect.matchEffect({
                  onSuccess: (snapshot) =>
                    Effect.sync(() =>
                      state.set({
                        ...snapshot,
                        status: 'ready',
                        error: undefined,
                      }),
                    ),
                  onFailure: () =>
                    Effect.sync(() =>
                      state.update((current) => ({
                        ...current,
                        status: 'unreadable',
                        error:
                          'Saved workspace selections could not be read. Try reading them again.',
                      })),
                    ),
                }),
                Effect.uninterruptible,
              );
            }),
          );
        }),
        selectEnvironment: Effect.fn('ProjectSelectionStore.selectEnvironment')(
          (environmentId: string) =>
            write(({ selections }) =>
              Effect.succeed({
                currentEnvironmentId: environmentId,
                selections,
              }),
            ),
        ),
        selectWorktree: Effect.fn('ProjectSelectionStore.selectWorktree')(
          (environmentId: string, projectId: string, worktreeId: string) =>
            write(({ currentEnvironmentId, selections }) => {
              if (currentEnvironmentId !== environmentId)
                return Effect.fail(
                  new ConnectionError({
                    message:
                      'The selected environment changed. Open its project picker again.',
                  }),
                );
              return Effect.succeed({
                currentEnvironmentId,
                selections: {
                  ...selections,
                  [environmentId]: { projectId, worktreeId },
                },
              });
            }),
        ),
        forgetEnvironment: Effect.fn('ProjectSelectionStore.forgetEnvironment')(
          (environmentId: string) =>
            write(({ currentEnvironmentId, selections }) =>
              Effect.succeed({
                currentEnvironmentId:
                  currentEnvironmentId === environmentId
                    ? undefined
                    : currentEnvironmentId,
                selections: Object.fromEntries(
                  Object.entries(selections).filter(
                    ([id]) => id !== environmentId,
                  ),
                ),
              }),
            ),
        ),
      };
    }),
  );
}
