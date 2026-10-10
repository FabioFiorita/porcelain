import { Effect, Layer } from 'effect';
import { WorkspaceSelectionCleanup } from '../ports/workspace-selection-cleanup.ts';
import { ProjectSelectionStore } from '../store.ts';
export const workspaceSelectionCleanupLayer = Layer.effect(
  WorkspaceSelectionCleanup,
  Effect.map(ProjectSelectionStore, (selection) => ({
    forgetEnvironment: selection.forgetEnvironment,
  })),
);
