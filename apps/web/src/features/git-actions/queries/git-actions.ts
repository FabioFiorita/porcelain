import { useQuery } from '@tanstack/react-query';
import { COMMIT_MODELS_STALE_MS } from '@/config/limits';
import { commitModelsQueryOptions } from '@porcelain/client/git-actions';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function useCommitModels(context: ConnectionContext) {
  return useQuery({
    ...commitModelsQueryOptions(context.connection),
    staleTime: COMMIT_MODELS_STALE_MS,
  });
}
