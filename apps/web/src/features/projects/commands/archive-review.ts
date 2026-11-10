import { useAtom } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { reviewCommands } from '@porcelain/client/reviews';
import { refreshInventory } from '@porcelain/client/projects';
import type { Connection as RuntimeConnection } from '@/shared/workspace/connection';
import type { ArchiveReviewRequest } from '@porcelain/contracts/reviews';
export function useArchiveReview(
  connection: RuntimeConnection,
  reviewId: string,
  onArchived?: () => void,
  beforeLeave?: () => void,
) {
  const [result, run] = useAtom(
    reviewCommands({ connection, reviewId }).archive,
    { mode: 'promise' },
  );
  const [, refresh] = useAtom(refreshInventory(connection), {
    mode: 'promise',
  });
  const navigate = useNavigate();
  return {
    result,
    submit: async (payload: ArchiveReviewRequest) => {
      if (payload.confirmation && beforeLeave) beforeLeave();
      let answer;
      try {
        answer = await run(payload);
        if (answer.archived) {
          await refresh();
          await navigate({ to: '/', replace: true });
        }
      } catch {
        return undefined;
      }
      if (answer.archived && onArchived) onArchived();
      return answer;
    },
  };
}
