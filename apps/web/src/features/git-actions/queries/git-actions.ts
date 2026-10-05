import { useAtomValue } from '@effect/atom-react';
import { readCommitModels } from '@porcelain/client/git-actions';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function useCommitModels(context: ConnectionContext) {
  return useAtomValue(readCommitModels(context.connection));
}
