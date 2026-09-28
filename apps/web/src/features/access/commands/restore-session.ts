import type { QueryClient } from '@tanstack/react-query';
import { sessionQueryOptions } from '../queries/session';
import { useAccessStore } from '../store';
import { queryKeys } from '@/shared/query/keys';

export async function restoreSession(client: QueryClient) {
  const restored = useAccessStore.getState().connection;
  if (restored) return true;
  const complete = useAccessStore.getState().beginConnection(true);
  if (!complete) return false;
  try {
    const inventory = await client.query({
      ...sessionQueryOptions(),
      staleTime: 'static',
    });
    if (complete(inventory)) {
      client.clear();
      client.setQueryData(
        queryKeys.inventory(inventory.environmentId),
        inventory,
      );
      void client.invalidateQueries({
        queryKey: queryKeys.inventory(inventory.environmentId),
      });
    }
  } catch {
    return false;
  }
  return useAccessStore.getState().connection !== null;
}
