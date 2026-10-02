import { useMutation, useQueryClient } from '@tanstack/react-query';
import { environmentQueryOptions } from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import { accessStore, pairingPlatform } from '../store';

export function useForgetEnvironment(remote: Remote) {
  const client = useQueryClient();
  const mutation = useMutation({
    scope: { id: 'access.environments' },
    mutationFn: async () => {
      const query = environmentQueryOptions(pairingPlatform(), remote);
      await client.cancelQueries({ queryKey: query.queryKey });
      await accessStore.getState().forget(remote.environmentId);
      client.removeQueries({ queryKey: query.queryKey });
    },
  });
  return {
    forget: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
