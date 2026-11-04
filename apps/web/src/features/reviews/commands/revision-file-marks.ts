import { useAtom } from '@effect/atom-react';
import { reviewCommands } from '@porcelain/client/reviews';
import type { ReviewRevision } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

export function useRevisionFileMarks(
  revision: ReviewRevision,
  context: ConnectionContext,
) {
  const commands = reviewCommands({
    connection: context.connection,
    reviewId: revision.reviewId,
  });
  const [markResult, mark] = useAtom(commands.mark);
  const [unmarkResult, unmark] = useAtom(commands.unmark);
  return { markResult, mark, unmarkResult, unmark };
}
