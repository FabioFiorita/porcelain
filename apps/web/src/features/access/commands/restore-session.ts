import type { QueryClient } from '@tanstack/react-query';
import { sessionQueryOptions } from '@porcelain/client/access';
import { browserTransport } from '@/shared/api/transport';
import { useAccessStore } from '../store';
import { queryKeys } from '@porcelain/client/transport';

export async function restoreSession(client: QueryClient) {
  const restored = useAccessStore.getState().connection;
  if (restored) return true;
  const complete = useAccessStore.getState().beginConnection(true);
  if (!complete) return false;
  const session = await client.query({
    ...sessionQueryOptions(
      browserTransport(fetch, { reportUnauthorized: false }),
    ),
    staleTime: 'static',
  });
  if (session === null) return false;
  const { inventory } = session;
  if (complete(session)) {
    client.clear();
    client.setQueryData(
      queryKeys.inventory(inventory.environmentId),
      inventory,
    );
    void client.invalidateQueries({
      queryKey: queryKeys.inventory(inventory.environmentId),
    });
  }
  return useAccessStore.getState().connection !== null;
}
