import { useAtomValue } from '@effect/atom-react';
import { liveQueries, inactiveLiveQueries } from '@porcelain/client/live';
import type { Connection } from '@/shared/workspace/connection';

export function useLiveQueries(
  connection: Connection | null,
  onUnauthorized: () => void,
) {
  useAtomValue(
    connection
      ? liveQueries({ connection, onUnauthorized })
      : inactiveLiveQueries,
  );
}
