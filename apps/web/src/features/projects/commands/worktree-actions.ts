import { useState } from 'react';
import { useAtomRef } from '@effect/atom-react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import {
  deleteWorktree,
  recoverWorktreeBranchSwitch,
  switchWorktreeBranch,
  readWorktreeBranchSwitch,
  type WorktreeCleanupRequest,
  type WorktreeCleanupPlan,
} from '@porcelain/client/projects';
import type { NavigatorEntry } from '@porcelain/client/projects/rules';
import type { Connection } from '@/shared/workspace/connection';
import { useLocalConnection } from '@/features/access';
import { useProjectCommand } from './manage-project';

type Selection = {
  connection: Connection;
  scope: { projectId: string; worktreeId: string };
};

export function useDeleteWorktreeAction(
  selection: Selection,
  entry: NavigatorEntry,
  onDone: () => void,
) {
  const [result, run] = useProjectCommand(deleteWorktree(selection));
  const local = useLocalConnection();
  const router = useRouter();
  const navigate = useNavigate();
  return {
    result,
    submit: (
      request: WorktreeCleanupRequest,
      onPlan: (plan: WorktreeCleanupPlan) => void,
      onFailure: () => void,
    ) =>
      run(request).then(async (answer) => {
        if (!answer.deleted) {
          onPlan(answer.plan);
          return;
        }
        onDone();
        const params = router.state.matches.at(-1)?.params;
        if (
          !answer.plan.worktreePath ||
          !params ||
          !('worktreeId' in params) ||
          !('projectId' in params) ||
          params.worktreeId !== selection.scope.worktreeId ||
          params.projectId !== selection.scope.projectId
        )
          return;
        const environmentId =
          'environmentId' in params
            ? params.environmentId
            : local?.environmentId;
        if (environmentId !== selection.connection.environmentId) return;
        if (entry.review.state === 'available')
          await navigate({
            to: '/reviews/$reviewId',
            params: { reviewId: entry.review.reviewId },
            search: {
              environment:
                environmentId === local?.environmentId
                  ? undefined
                  : environmentId,
              decision: undefined,
            },
          });
        else await navigate({ to: '/' });
      }, onFailure),
  };
}

export function useSwitchWorktreeBranchAction(selection: Selection) {
  const [result, run] = useProjectCommand(switchWorktreeBranch(selection));
  const [recovered, recover] = useProjectCommand(
    recoverWorktreeBranchSwitch(selection),
  );
  const [recovering, setRecovering] = useState(false);
  const { unresolved } = useAtomRef(readWorktreeBranchSwitch(selection));
  return {
    result: recovering ? recovered : result,
    pending: result.waiting || recovered.waiting,
    unresolved,
    submit: (chosen: string | undefined, onDone: () => void) => {
      setRecovering(unresolved);
      let request;
      if (unresolved) request = recover(undefined);
      else if (chosen) request = run(chosen);
      else return;
      return request.then(
        (receipt) => {
          if (receipt.state === 'succeeded' || receipt.state === 'no-change')
            onDone();
        },
        () => undefined,
      );
    },
  };
}
