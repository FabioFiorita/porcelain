import { useMutation, useQueryClient } from '@tanstack/react-query';
import { environmentQueryOptions } from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import { accessStore, pairingPlatform } from '../store';

export type ProjectCleanup = (environmentId: string) => Promise<void>;

export function useForgetEnvironment(
  remote: Remote,
  forgetProjectEnvironment: ProjectCleanup,
) {
  const client = useQueryClient();
  const mutation = useMutation({
    scope: { id: 'access.environments' },
    mutationKey: ['projects', 'selection'],
    mutationFn: async () => {
      const query = environmentQueryOptions(pairingPlatform(), remote);
      await client.cancelQueries({ queryKey: query.queryKey });
      await accessStore.getState().forget(remote.environmentId);
      client.removeQueries({ queryKey: query.queryKey });
      await forgetProjectEnvironment(remote.environmentId);
    },
  });
  return {
    forget: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
