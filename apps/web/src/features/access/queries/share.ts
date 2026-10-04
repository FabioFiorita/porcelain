import { queryKeys } from '@porcelain/client/transport';
import { queryOptions, useQuery } from '@tanstack/react-query';
import {
  REMOTE_ACCESS_SETTLING_POLL_MS,
  SERVICE_UPDATE_POLL_MS,
} from '@/config/limits';
import { shareApi } from '../api';
import { routesSettling } from '../rules/share';
import { type Connection } from '@/shared/workspace/connection';

function pairedAccessQueryOptions(connection: Connection) {
  return queryOptions({
    queryKey: queryKeys.pairedAccess(connection.environmentId),
    queryFn: ({ signal }) =>
      shareApi(connection).list({ signal: connection.request(signal).signal }),
  });
}

function remoteAccessQueryOptions(connection: Connection) {
  return queryOptions({
    queryKey: queryKeys.remoteAccess(connection.environmentId),
    queryFn: ({ signal }) =>
      shareApi(connection).remote({
        signal: connection.request(signal).signal,
      }),
    refetchInterval: (query) =>
      routesSettling(query.state.data) ? REMOTE_ACCESS_SETTLING_POLL_MS : false,
  });
}

export function usePairedAccess(connection: Connection) {
  return useQuery(pairedAccessQueryOptions(connection));
}

export function useRemoteAccess(connection: Connection) {
  const query = useQuery(remoteAccessQueryOptions(connection));
  return {
    data: query.data,
    isPending: query.isPending,
    error: query.error,
    managedElsewhere: query.data === null,
  };
}

function serviceUpdateQueryOptions(connection: Connection) {
  return queryOptions({
    queryKey: queryKeys.serviceUpdate(connection.environmentId),
    queryFn: ({ signal }) =>
      shareApi(connection).serviceUpdate({
        signal: connection.request(signal).signal,
      }),
    refetchInterval: (query) =>
      query.state.data?.running === true ? SERVICE_UPDATE_POLL_MS : false,
    retry: false,
  });
}

export function useServiceUpdate(connection: Connection) {
  const query = useQuery(serviceUpdateQueryOptions(connection));
  return {
    data: query.data,
    error: query.error,
    unreachable: query.isRefetchError,
  };
}
