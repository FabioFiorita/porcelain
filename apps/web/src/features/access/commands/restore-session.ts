import type { QueryClient } from '@tanstack/react-query';
import { sessionQueryOptions } from '@porcelain/client/access';
import { browserTransport } from '@/shared/api/transport';
import { accessSession } from '../store';
import { queryKeys } from '@porcelain/client/transport';

export async function restoreSession(client: QueryClient) {
  const restored = accessSession.state.value.connection;
  if (restored) return true;
  const complete = accessSession.beginConnection(true);
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
  return accessSession.state.value.connection !== null;
}
