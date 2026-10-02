import { queryOptions, useQuery } from '@tanstack/react-query';
import {
  REMOTE_STATUS_REFRESH_MS,
  REMOTE_STATUS_TIMEOUT_MS,
} from '@/config/limits';
import { remoteTransport } from '@porcelain/client/transport';
import { remoteApi } from '../api';
import { remoteStatus, type Remote } from '../rules/remotes';

export function remoteStatusQueryOptions(remote: Remote) {
  return queryOptions({
    queryKey: ['remote-status', remote.environmentId, remote.address],
    queryFn: ({ signal }) =>
      remoteApi.describe(
        remoteTransport(remote.address, remote.credential, fetch),
        AbortSignal.any([
          signal,
          AbortSignal.timeout(REMOTE_STATUS_TIMEOUT_MS),
        ]),
      ),
    refetchInterval: (query) =>
      remoteStatus(remote, query.state.data).kind === 'other-server'
        ? false
        : REMOTE_STATUS_REFRESH_MS,
    retry: false,
  });
}

export function useRemoteStatus(remote: Remote) {
  const query = useQuery(remoteStatusQueryOptions(remote));
  return remoteStatus(remote, query.data);
}
