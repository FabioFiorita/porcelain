import { queryOptions, useQuery } from '@tanstack/react-query';
import {
  REMOTE_ACCESS_SETTLING_POLL_MS,
  SERVICE_UPDATE_POLL_MS,
} from '@/config/limits';
import { shareApi } from '../api';
import { routesSettling, type ShareConnection } from '../rules/share';

export function pairedAccessQueryOptions(connection: ShareConnection) {
  return queryOptions({
    queryKey: ['paired-access', connection.environmentId],
    queryFn: ({ signal }) => shareApi.list(connection.request(signal).signal),
  });
}

export function remoteAccessQueryOptions(connection: ShareConnection) {
  return queryOptions({
    queryKey: ['remote-access', connection.environmentId],
    queryFn: ({ signal }) => shareApi.remote(connection.request(signal).signal),
    refetchInterval: (query) =>
      routesSettling(query.state.data) ? REMOTE_ACCESS_SETTLING_POLL_MS : false,
  });
}

export function usePairedAccess(connection: ShareConnection) {
  return useQuery(pairedAccessQueryOptions(connection));
}

export function useRemoteAccess(connection: ShareConnection) {
  const query = useQuery(remoteAccessQueryOptions(connection));
  return {
    data: query.data,
    isPending: query.isPending,
    error: query.error,
    managedElsewhere: query.data === null,
  };
}

export function serviceUpdateQueryOptions(connection: ShareConnection) {
  return queryOptions({
    queryKey: ['service-update', connection.environmentId],
    queryFn: ({ signal }) =>
      shareApi.serviceUpdate(connection.request(signal).signal),
    refetchInterval: (query) =>
      query.state.data?.running === true ? SERVICE_UPDATE_POLL_MS : false,
    retry: false,
  });
}

export function useServiceUpdate(connection: ShareConnection) {
  const query = useQuery(serviceUpdateQueryOptions(connection));
  return {
    data: query.data,
    error: query.error,
    unreachable: query.isRefetchError,
  };
}
