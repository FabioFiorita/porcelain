import { readProjectReviews } from '@porcelain/client/reviews';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import type { ConnectionContext } from '@/shared/workspace/connection';
export function useProjectHistory(
  projectId: string,
  context: ConnectionContext,
) {
  return useConfirmedRead(
    readProjectReviews({ projectId, connection: context.connection }),
  );
}
