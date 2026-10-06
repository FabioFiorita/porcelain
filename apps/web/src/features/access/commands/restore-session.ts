import type { QueryClient } from '@tanstack/react-query';
import { sessionQueryOptions } from '@porcelain/client/access';
import { browserTransport } from '@/shared/api/transport';
import { accessSession } from '../store';

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
  if (complete(session)) {
    client.clear();
  }
  return accessSession.state.value.connection !== null;
}
