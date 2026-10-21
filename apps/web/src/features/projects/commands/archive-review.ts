import { useLocalConnection } from '@/features/access';
import { useAtom } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { reviewCommands } from '@porcelain/client/reviews';
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
  const navigate = useNavigate();
  const local = useLocalConnection();
  const environment =
    connection.environmentId === local?.environmentId
      ? undefined
      : connection.environmentId;
  return {
    result,
    submit: async (payload: ArchiveReviewRequest) => {
      if (payload.confirmation && beforeLeave) beforeLeave();
      let answer;
      try {
        if (payload.confirmation)
          await navigate({
            to: '/reviews/$reviewId',
            params: { reviewId },
            search: {
              environment,
              decision: undefined,
            },
          });
        answer = await run(payload);
      } catch {
        return undefined;
      }
      if (answer.archived && onArchived) onArchived();
      return answer;
    },
  };
}
