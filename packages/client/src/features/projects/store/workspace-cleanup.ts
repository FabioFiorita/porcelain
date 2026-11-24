import { Effect, Layer, Option } from 'effect';
import { WorkspaceSelectionCleanup } from '../ports/workspace-selection-cleanup.ts';
import { ProjectSelectionStore } from '../store.ts';
import { WorktreeSnapshots } from './worktree-snapshot.ts';
export const workspaceSelectionCleanupLayer = Layer.effect(
  WorkspaceSelectionCleanup,
  Effect.gen(function* () {
    const selection = yield* ProjectSelectionStore;
    const snapshots = yield* Effect.serviceOption(WorktreeSnapshots);
    return {
      forgetEnvironment: (environmentId) =>
        selection.forgetEnvironment(environmentId).pipe(
          Effect.ensuring(
            Option.match(snapshots, {
              onNone: () => Effect.void,
              onSome: (store) => store.remove(environmentId),
            }),
          ),
        ),
    };
  }),
);
