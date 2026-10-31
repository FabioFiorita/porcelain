import { useAtom, useAtomRef } from '@effect/atom-react';
import { Effect, Exit } from 'effect';
import { Atom } from 'effect/reactivity';
import {
  deleteWorktree,
  readInventory,
  ProjectSelectionCommands,
  ProjectSelectionStore,
  switchWorktreeBranch,
  recoverWorktreeBranchSwitch,
  readWorktreeBranchSwitch,
  type WorktreeCleanupRequest,
  type WorktreeCleanupPlan,
} from '@porcelain/client/projects';
import type { EnvironmentConnection } from '@porcelain/client/access';
import { requestDocumentLeave } from '../store';
import {
  clientRuntime,
  selectionState,
} from '../../../shared/application/store';
import { worktreeActionSelected } from '../rules/worktree-action-selection';

type Selection = {
  connection: EnvironmentConnection;
  scope: { projectId: string; worktreeId: string };
};

function selectedTarget(selection: Selection) {
  return worktreeActionSelected(selectionState.value, {
    environmentId: selection.connection.environmentId,
    ...selection.scope,
  });
}

const deleteCommand = Atom.family((selection: Selection) =>
  clientRuntime.fn(
    Effect.fn('Projects.deleteNativeWorktree')(function* (
      request: WorktreeCleanupRequest,
      get: Atom.FnContext,
    ) {
      let mainWorktreeId: string | undefined;
      if (request.confirmation && selectedTarget(selection)) {
        const inventory = yield* get.result(
          readInventory(selection.connection),
          { suspendOnWaiting: true },
        );
        mainWorktreeId = inventory.projects
          .find((project) => project.id === selection.scope.projectId)
          ?.worktrees.find(
            (worktree) => worktree.main && worktree.available,
          )?.id;
      }
      const answer = yield* get.setResult(deleteWorktree(selection), request);
      if (
        answer.deleted &&
        answer.plan.worktreePath &&
        selectedTarget(selection)
      ) {
        if (mainWorktreeId) {
          const commands = yield* ProjectSelectionCommands;
          yield* commands.execute({
            kind: 'workspace',
            environmentId: selection.connection.environmentId,
            projectId: selection.scope.projectId,
            worktreeId: mainWorktreeId,
          });
        } else {
          const selections = yield* ProjectSelectionStore;
          yield* selections.forgetEnvironment(
            selection.connection.environmentId,
          );
        }
      }
      return answer;
    }),
  ),
);

export function useDeleteWorktree(selection: Selection) {
  const [result, run] = useAtom(deleteCommand(selection), {
    mode: 'promiseExit',
  });
  return {
    result,
    preview: (
      options: WorktreeCleanupRequest['options'],
      onPlan: (plan: WorktreeCleanupPlan) => void,
    ) => {
      void run({ options }).then((exit) => {
        if (Exit.isSuccess(exit)) onPlan(exit.value.plan);
      });
    },
    confirm: (
      request: WorktreeCleanupRequest,
      onDone: (plan: WorktreeCleanupPlan) => void,
      onFailure: () => void,
    ) => {
      const perform = () => {
        void run(request).then((exit) => {
          if (Exit.isSuccess(exit) && exit.value.deleted)
            onDone(exit.value.plan);
          else if (Exit.isFailure(exit)) onFailure();
        });
      };
      if (selectedTarget(selection)) requestDocumentLeave(perform);
      else perform();
    },
  };
}

export function useSwitchWorktreeBranch(selection: Selection) {
  const [result, run] = useAtom(switchWorktreeBranch(selection), {
    mode: 'promiseExit',
  });
  const [recovered, recover] = useAtom(recoverWorktreeBranchSwitch(selection), {
    mode: 'promiseExit',
  });
  const { unresolved } = useAtomRef(readWorktreeBranchSwitch(selection));
  return {
    result,
    recovered,
    unresolved,
    pending: result.waiting || recovered.waiting,
    submit: (ref: string | undefined, onDone: () => void) => {
      const perform = () => {
        let request;
        if (unresolved) request = recover(undefined);
        else if (ref) request = run(ref);
        else return;
        void request.then((exit) => {
          if (
            Exit.isSuccess(exit) &&
            (exit.value.state === 'succeeded' ||
              exit.value.state === 'no-change')
          )
            onDone();
        });
      };
      if (!unresolved && selectedTarget(selection))
        requestDocumentLeave(perform);
      else perform();
    },
  };
}
