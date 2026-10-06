import { Context, Effect, Layer } from 'effect';
import { AccessStore } from '../../access/store.ts';
import { EnvironmentMutations } from '../../access/store/environment-mutations.ts';
import { ProjectSelectionStore } from '../store.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';

type SelectionCommand =
  | { readonly kind: 'read' }
  | { readonly kind: 'environment'; readonly environmentId: string }
  | {
      readonly kind: 'worktree';
      readonly environmentId: string;
      readonly projectId: string;
      readonly worktreeId: string;
    };

const makeSelectionCommands = Effect.gen(function* () {
  const access = yield* AccessStore;
  const selection = yield* ProjectSelectionStore;
  const mutations = yield* EnvironmentMutations;
  return {
    pending: mutations.pendingSelections,
    execute: Effect.fn('WorkspaceSelection.execute')(
      (command: SelectionCommand) =>
        mutations.run(
          'selection',
          Effect.gen(function* () {
            if (command.kind === 'read') {
              yield* selection.load();
              if (
                access.state.value.status !== 'ready' ||
                selection.state.value.status !== 'ready'
              )
                return;
              const paired = new Set(
                access.state.value.remotes.map(
                  (remote) => remote.environmentId,
                ),
              );
              const remembered = new Set(
                Object.keys(selection.state.value.selections),
              );
              if (selection.state.value.currentEnvironmentId)
                remembered.add(selection.state.value.currentEnvironmentId);
              for (const environmentId of remembered)
                if (!paired.has(environmentId))
                  yield* selection.forgetEnvironment(environmentId);
              return;
            }
            if (
              access.state.value.status !== 'ready' ||
              !access.state.value.remotes.some(
                (remote) => remote.environmentId === command.environmentId,
              )
            )
              return yield* Effect.fail(
                new ConnectionError({
                  message:
                    'That environment is no longer paired. Open the environment picker again.',
                }),
              );
            if (command.kind === 'environment')
              return yield* selection.selectEnvironment(command.environmentId);
            yield* selection.selectWorktree(
              command.environmentId,
              command.projectId,
              command.worktreeId,
            );
          }),
        ),
    ),
  };
});

export class ProjectSelectionCommands extends Context.Service<
  ProjectSelectionCommands,
  Effect.Success<typeof makeSelectionCommands>
>()('@porcelain/client/ProjectSelectionCommands') {
  static readonly layer = Layer.effect(
    ProjectSelectionCommands,
    makeSelectionCommands,
  );
}
