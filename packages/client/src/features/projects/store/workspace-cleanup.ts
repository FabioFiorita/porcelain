import { Effect, Layer } from 'effect';
import { WorkspaceSelectionCleanup } from '../ports/workspace-selection-cleanup.ts';
import { ProjectSelectionStore } from '../store.ts';
import { WorktreeSnapshots } from './worktree-snapshot.ts';
export const workspaceSelectionCleanupLayer = Layer.effect(
  WorkspaceSelectionCleanup,
  Effect.gen(function* () {
    const selection = yield* ProjectSelectionStore;
    const snapshots = yield* WorktreeSnapshots;
    return {
      forgetEnvironment: (environmentId) =>
        selection
          .forgetEnvironment(environmentId)
          .pipe(Effect.ensuring(snapshots.remove(environmentId))),
    };
  }),
);
