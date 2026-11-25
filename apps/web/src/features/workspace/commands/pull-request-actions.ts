import { useAtom } from '@effect/atom-react';
import { Cause, Exit } from 'effect';
import {
  commentOnPullRequest,
  rerunPullRequestChecks,
} from '@porcelain/client/projects';
import type {
  PullRequestRerunTarget,
  PullStatus,
} from '@porcelain/client/projects/rules';
import type { Connection } from '@/shared/workspace/connection';
import { notify } from '@/shared/views/notify';

export function actionFailureMessage(cause: Cause.Cause<unknown>) {
  const error = Cause.squash(cause);
  return error instanceof Error && error.message
    ? error.message
    : 'GitHub did not take the request. Try again.';
}

export function useRerunChecks(
  connection: Connection,
  projectId: string,
  number: number,
) {
  const [result, run] = useAtom(
    rerunPullRequestChecks({ connection, projectId, number }),
    { mode: 'promiseExit' },
  );
  return {
    pending: result.waiting,
    rerun: async (
      status: PullStatus,
      target: PullRequestRerunTarget,
      keys: readonly string[],
    ) => {
      const exit = await run({
        payload: { headSha: status.headSha, target },
        reruns: keys.map((key) => ({
          key,
          jobId: status.checks.find((check) => check.key === key)?.jobId,
        })),
      });
      if (Exit.isSuccess(exit)) return;
      notify({
        title: 'Re-run refused',
        description: actionFailureMessage(exit.cause),
        type: 'error',
      });
    },
  };
}

export function useCommentOnPullRequest(
  connection: Connection,
  projectId: string,
  number: number,
  onPosted: () => void,
) {
  const [result, run] = useAtom(
    commentOnPullRequest({ connection, projectId, number }),
    { mode: 'promiseExit' },
  );
  return {
    result,
    submit: async (body: string) => {
      const exit = await run({ body });
      if (!Exit.isSuccess(exit)) return;
      onPosted();
      notify({ title: `Commented on #${number}`, type: 'success' });
    },
  };
}

export async function copyLog(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    notify({ title: 'Copied the log lines', type: 'success' });
  } catch {
    notify({ title: 'Could not copy the log lines', type: 'error' });
  }
}
