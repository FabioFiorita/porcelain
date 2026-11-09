import { useAtomSet } from '@effect/atom-react';
import { Exit } from 'effect';
import { retryWorktreeReads } from '@porcelain/client/transport';
import type { Connection } from '@/shared/workspace/connection';
import type { ReviewScope } from '@porcelain/client/reviews/rules';

export function useRetryReview(connection: Connection, scope: ReviewScope) {
  const retry = useAtomSet(retryWorktreeReads(connection), {
    mode: 'promiseExit',
  });
  return (show: () => void) => {
    void retry(scope).then((exit) => {
      if (Exit.isSuccess(exit)) show();
    });
  };
}
