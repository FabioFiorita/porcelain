import { useMutation, useQueryClient } from '@tanstack/react-query';
import { disconnectBrowserSession } from '@porcelain/client/access';
import { runRequest } from '@porcelain/client/transport';
import { browserTransport } from '@/shared/api/transport';
import { REQUEST_TIMEOUT_MS } from '@/config/limits';
import { accessSession } from '../store';

function disconnectSession() {
  return runRequest(
    disconnectBrowserSession(
      browserTransport(fetch),
      accessSession.state.value.connection?.environmentId,
    ),
    AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  );
}

export function useDisconnect() {
  const client = useQueryClient();
  const mutation = useMutation({
    scope: { id: 'access.session' },
    mutationFn: disconnectSession,
    onSuccess: async () => {
      accessSession.clear();
      await client.cancelQueries();
      client.clear();
    },
  });
  return {
    submit: mutation.mutateAsync,
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
