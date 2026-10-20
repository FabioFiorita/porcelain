import { useAtom } from '@effect/atom-react';
import { commentWriteBinding, reviewCommands } from '@porcelain/client/reviews';
import type { ConnectionContext } from '@/shared/workspace/connection';
export function useReviewDeletion(
  reviewId: string,
  context: ConnectionContext,
) {
  return commentWriteBinding(
    useAtom(
      reviewCommands({ connection: context.connection, reviewId }).remove,
      { mode: 'promiseExit' },
    ),
  );
}
