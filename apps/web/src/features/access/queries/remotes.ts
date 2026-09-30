import { queryOptions, useQuery } from '@tanstack/react-query';
import {
  REMOTE_STATUS_REFRESH_MS,
  REMOTE_STATUS_TIMEOUT_MS,
} from '@/config/limits';
import { remoteApi } from '../api';
import { remoteStatus, type Remote } from '../rules/remotes';

export function remoteStatusQueryOptions(remote: Remote) {
  return queryOptions({
    queryKey: ['remote-status', remote.environmentId, remote.address],
    queryFn: ({ signal }) =>
      remoteApi.describe(
        remote,
        AbortSignal.any([
          signal,
          AbortSignal.timeout(REMOTE_STATUS_TIMEOUT_MS),
        ]),
      ),
    refetchInterval: REMOTE_STATUS_REFRESH_MS,
    retry: false,
  });
}

export function useRemoteStatus(remote: Remote) {
  const query = useQuery(remoteStatusQueryOptions(remote));
  return remoteStatus(remote, query.data);
}
