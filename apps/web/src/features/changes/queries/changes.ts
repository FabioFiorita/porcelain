import { changesQueryOptions } from '@porcelain/client/changes';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { type ChangesScope } from '../rules/changes';
import {
  type Connection,
  requireConnection,
} from '@/shared/workspace/connection';

export function useChanges(scope: ChangesScope, connection: Connection | null) {
  return useSuspenseQuery(
    changesQueryOptions(scope, requireConnection(connection)),
  ).data;
}

export function useReviewOverview(
  scope: ChangesScope,
  connection: Connection | null,
) {
  return useQuery({
    ...changesQueryOptions(scope, requireConnection(connection)),
    throwOnError: false,
  }).data;
}
