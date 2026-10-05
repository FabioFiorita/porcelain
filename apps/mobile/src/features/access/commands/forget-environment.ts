import { Effect } from 'effect';
import { useMutation } from '@tanstack/react-query';
import type { Remote } from '@porcelain/client/access/rules';
import { accessStore } from '../store';

export type ProjectCleanup = (environmentId: string) => Promise<void>;

export function useForgetEnvironment(
  remote: Remote,
  forgetProjectEnvironment: ProjectCleanup,
) {
  const mutation = useMutation({
    scope: { id: 'access.environments' },
    mutationKey: ['projects', 'selection'],
    mutationFn: async () => {
      await Effect.runPromise(accessStore.forget(remote.environmentId));
      await forgetProjectEnvironment(remote.environmentId);
    },
  });
  return {
    forget: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
