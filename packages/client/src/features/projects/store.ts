import { persistedState } from '../persistence/store.ts';
import { Context, Effect, Layer } from 'effect';
import type { AtomRef } from 'effect/reactivity';
import { type WriteNotSentError } from '../../shared/api/write-queue.ts';
import type { ConnectionError } from '../../shared/api/connection-error.ts';
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
    readonly selectWorkspace: (
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
      const owner = yield* persistedState<ProjectSelectionSnapshot>({
        initial: { currentEnvironmentId: undefined, selections: {} },
        read: storage.read,
        write: storage.write,
        messages: {
          beforeRead:
            'Saved workspace selections must be read before changing them.',
          readFailed:
            'Saved workspace selections could not be read. Try reading them again.',
          writeFailed:
            'Saved workspace selections could not be updated. Read them again before making changes.',
        },
      });
      const write = owner.write;
      return {
        state: owner.state,
        load: owner.load,
        selectWorkspace: Effect.fn('ProjectSelectionStore.selectWorkspace')(
          (environmentId: string, projectId: string, worktreeId: string) =>
            write(({ selections }) =>
              Effect.succeed({
                currentEnvironmentId: environmentId,
                selections: {
                  ...selections,
                  [environmentId]: { projectId, worktreeId },
                },
              }),
            ),
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
