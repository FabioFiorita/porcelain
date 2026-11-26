import { useAtom, useAtomSet } from '@effect/atom-react';
import { Cause, Exit } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  commentOnPullRequest,
  mergePullRequest,
  rerunPullRequestChecks,
} from '@porcelain/client/projects';
import {
  mergeFailureMessage,
  pullRequestActionFailure,
  type PullRequestMergeMethod,
  type PullStatus,
  type RerunRequest,
} from '@porcelain/client/projects/rules';
import { notify as notifyCommand } from '../../../shared/application/notify';
import { copyToClipboard } from '../../../shared/adapters/clipboard';
import { useWriteAllowed } from '../../access';
import type { PullRequestRef } from '../queries/pull-request';

export function useRerunChecks(target: PullRequestRef) {
  const [result, run] = useAtom(rerunPullRequestChecks(target), {
    mode: 'promiseExit',
  });
  const allowed = useWriteAllowed(target.connection.environmentId);
  return {
    pending: result.waiting,
    failure: actionFailure(result),
    rerun: async (status: PullStatus, request: RerunRequest) => {
      if (!allowed()) return;
      await run({
        payload: { headSha: status.headSha, target: request.target },
        reruns: request.keys.map((key) => ({
          key,
          jobId: status.checks.find((check) => check.key === key)?.jobId,
        })),
      });
    },
  };
}

function actionFailure(result: AsyncResult.AsyncResult<unknown, unknown>) {
  return AsyncResult.isFailure(result)
    ? pullRequestActionFailure(Cause.squash(result.cause))
    : undefined;
}

export function useCommentOnPullRequest(
  target: PullRequestRef,
  onPosted: () => void,
) {
  const [result, run] = useAtom(commentOnPullRequest(target), {
    mode: 'promiseExit',
  });
  const notify = useAtomSet(notifyCommand);
  const allowed = useWriteAllowed(target.connection.environmentId);
  return {
    pending: result.waiting,
    failure: actionFailure(result),
    submit: async (body: string) => {
      if (!allowed()) return;
      const exit = await run({ body });
      if (!Exit.isSuccess(exit)) return;
      onPosted();
      notify({
        kind: 'pull-request',
        action: 'commented',
        number: target.number,
      });
    },
  };
}

export function useMergePullRequest(
  target: PullRequestRef,
  onMerged: () => void,
) {
  const [result, run] = useAtom(mergePullRequest(target), {
    mode: 'promiseExit',
  });
  const notify = useAtomSet(notifyCommand);
  const allowed = useWriteAllowed(target.connection.environmentId);
  return {
    pending: result.waiting,
    failure: AsyncResult.isFailure(result)
      ? mergeFailureMessage(Cause.squash(result.cause))
      : undefined,
    submit: async (method: PullRequestMergeMethod, headSha: string) => {
      if (!allowed()) return;
      const exit = await run({ method, headSha });
      if (!Exit.isSuccess(exit)) return;
      onMerged();
      notify({ kind: 'pull-request', action: 'merged', number: target.number });
    },
  };
}

export function useCopyLog() {
  const notify = useAtomSet(notifyCommand);
  return (text: string) =>
    copyToClipboard(text).then(
      () => notify({ kind: 'copy', target: 'log lines' }),
      () => undefined,
    );
}
