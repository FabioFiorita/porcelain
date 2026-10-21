import { useConnectedContext } from '@/features/access';
import { useAtom } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { reviewCommands } from '@porcelain/client/reviews';
import type { Connection as RuntimeConnection } from '@/shared/workspace/connection';
import type { ArchiveReviewRequest } from '@porcelain/contracts/reviews';
export function useArchiveReview(
  connection: RuntimeConnection,
  reviewId: string,
) {
  const [result, run] = useAtom(
    reviewCommands({ connection, reviewId }).archive,
    { mode: 'promise' },
  );
  const navigate = useNavigate();
  const local = useConnectedContext();
  const environment =
    connection.environmentId === local.connection.environmentId
      ? undefined
      : connection.environmentId;
  return {
    result,
    submit: async (payload: ArchiveReviewRequest) => {
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
        return await run(payload);
      } catch {
        return undefined;
      }
    },
  };
}
