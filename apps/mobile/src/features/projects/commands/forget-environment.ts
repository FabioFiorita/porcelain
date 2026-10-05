import { Effect } from 'effect';
import { useQueryClient } from '@tanstack/react-query';
import { inventoryScopeQueryOptions } from '@porcelain/client/projects';
import { projectSelectionStore } from '../store';

export function useForgetProjectEnvironment() {
  const client = useQueryClient();
  return async (environmentId: string) => {
    const query = inventoryScopeQueryOptions(environmentId);
    await client.cancelQueries(query);
    try {
      await Effect.runPromise(
        projectSelectionStore.forgetEnvironment(environmentId),
      );
    } finally {
      client.removeQueries(query);
    }
  };
}
