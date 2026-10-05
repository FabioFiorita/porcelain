import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { connectLiveQueries } from '@porcelain/client/live';
import type { Connection } from '@/shared/workspace/connection';

export function useLiveQueries(
  connection: Connection | null,
  onUnauthorized: () => void,
) {
  const client = useQueryClient();
  useEffect(() => {
    if (!connection) return;
    return connectLiveQueries(client, connection, onUnauthorized);
  }, [client, connection, onUnauthorized]);
}
