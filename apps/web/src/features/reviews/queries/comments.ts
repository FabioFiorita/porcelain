import { readCommentThreads } from '@porcelain/client/reviews';
import { useAtomMount } from '@effect/atom-react';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

export function useComments(scope: ReviewScope, context: ConnectionContext) {
  const { result, value: threads } = useConfirmedRead(
    readCommentThreads({ scope, connection: context.connection }),
  );
  return { threads, result };
}
export function usePrefetchComments(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  useAtomMount(readCommentThreads({ scope, connection: context.connection }));
}
