import { changesQueryOptions } from '@porcelain/client/changes';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { type ChangesScope } from '../rules/changes';
import { type Connection } from '@/shared/workspace/connection';

export function useChanges(scope: ChangesScope, connection: Connection) {
  return useSuspenseQuery(changesQueryOptions(scope, connection)).data;
}

export function useReviewOverview(scope: ChangesScope, connection: Connection) {
  return useQuery({
    ...changesQueryOptions(scope, connection),
    throwOnError: false,
  }).data;
}
