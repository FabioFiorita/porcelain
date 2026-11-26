import { useAtom } from '@effect/atom-react';
import { Exit } from 'effect';
import { mergePullRequest } from '@porcelain/client/projects';
import type { MergePullRequestRequest } from '@porcelain/contracts/projects';
import type { Connection as RuntimeConnection } from '@/shared/workspace/connection';
import { notify } from '@/shared/views/notify';

export function useMergePullRequest(
  connection: RuntimeConnection,
  projectId: string,
  number: number,
  onMerged: () => void,
) {
  const [result, run] = useAtom(
    mergePullRequest({ connection, projectId, number }),
    { mode: 'promiseExit' },
  );
  return {
    result,
    submit: async (payload: MergePullRequestRequest) => {
      const exit = await run(payload);
      if (!Exit.isSuccess(exit)) return;
      onMerged();
      notify({ title: `Merged #${number}`, type: 'success' });
    },
  };
}
