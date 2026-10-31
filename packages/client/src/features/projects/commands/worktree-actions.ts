import type { GitConnection } from '../../git-actions/ports/git-connection.ts';
import { FileDrafts } from '../../files/store.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { Effect, Layer } from 'effect';
import { Atom, AtomRegistry, Reactivity } from 'effect/reactivity';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { requestApi } from '../../../shared/api/client.ts';
import type { DeleteWorktreeRequest } from '@porcelain/contracts/projects';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { readGitStatusSnapshot } from '../../changes/queries/changes.ts';
import { readGitActionCommands } from '../../git-actions/commands/git-action-controller.ts';
type BranchSwitchSelection = {
  connection: GitConnection;
  scope: WorktreeSelection['scope'];
};
const branchSwitchCommands = Effect.fn('Projects.branchSwitchCommands')(
  function* (selection: BranchSwitchSelection) {
    const registry = yield* AtomRegistry.AtomRegistry;
    return yield* AtomRegistry.getResult(
      registry,
      readGitActionCommands({ ...selection, action: 'switch' }),
      { suspendOnWaiting: true },
    );
  },
);
const worktreeActionRuntime = Atom.family(
  (connection: WorktreeSelection['connection']) =>
    connection.atoms((get) =>
      Layer.merge(get(clientRuntime(connection).layer), FileDrafts.layer),
    ),
);
const requireSavedDrafts = Effect.fn('Projects.requireSavedWorktreeDrafts')(
  function* (selection: WorktreeSelection) {
    const drafts = yield* FileDrafts;
    if (
      drafts.hasUnsavedWorktree(
        selection.connection.environmentId,
        selection.scope,
      )
    )
      return yield* new ConnectionError({
        message:
          'Save or discard unsaved file drafts before changing this worktree.',
      });
  },
);
export const deleteWorktree = Atom.family((selection: WorktreeSelection) =>
  worktreeActionRuntime(selection.connection).fn(
    Effect.fn('Projects.deleteWorktree')(function* (
      input: DeleteWorktreeRequest,
    ) {
      if (input.confirmation) yield* requireSavedDrafts(selection);
      const result = yield* requestApi(selection.connection, (api) =>
        api.projects.deleteWorktree({
          params: { worktreeId: selection.scope.worktreeId },
          payload: input,
        }),
      );
      yield* currentAnswerEffect(selection.connection);
      if (result.deleted)
        yield* Reactivity.invalidate([
          queryKeys.inventory(selection.connection.environmentId),
          queryKeys.worktreeInventory(selection.connection.environmentId),
          queryKeys.projectReviews(selection.connection.environmentId),
        ]);
      return result;
    }),
  ),
);
export const switchWorktreeBranch = Atom.family(
  (selection: BranchSwitchSelection) =>
    worktreeActionRuntime(selection.connection).fn(
      Effect.fn('Projects.switchWorktreeBranch')(function* (targetRef: string) {
        yield* requireSavedDrafts(selection);
        const commands = yield* branchSwitchCommands(selection);
        const status = yield* readGitStatusSnapshot(selection);
        yield* commands.startNew();
        return yield* commands.run(
          { action: 'switch', targetRef },
          {
            headOid: status.headOid,
            branch: status.branch?.name,
            inProgress: status.inProgress,
            mergeHeadOid: status.mergeHeadOid,
          },
        );
      }),
    ),
);

export const recoverWorktreeBranchSwitch = Atom.family(
  (selection: BranchSwitchSelection) =>
    worktreeActionRuntime(selection.connection).fn(
      Effect.fn('Projects.recoverWorktreeBranchSwitch')(function* (_: void) {
        yield* requireSavedDrafts(selection);
        const commands = yield* branchSwitchCommands(selection);
        return yield* commands.recover();
      }),
    ),
);
