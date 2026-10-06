import { useAtom } from '@effect/atom-react';
import type { GitScope } from '@porcelain/client/git-actions/rules';
import { dismissInterruptedGitAction } from '@porcelain/client/git-actions';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function useDismissInterrupted(
  scope: GitScope,
  context: ConnectionContext,
) {
  const [result, dismiss] = useAtom(
    dismissInterruptedGitAction({ connection: context.connection, scope }),
    { mode: 'promiseExit' },
  );
  return {
    result,
    dismiss: (requestId: string) => {
      void dismiss(requestId);
    },
  };
}
