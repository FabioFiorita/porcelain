import { useQuery } from '@tanstack/react-query';
import {
  pairedAccessQueryOptions,
  remoteAccessQueryOptions,
  serviceUpdateQueryOptions,
} from '@porcelain/client/access';
import type { Connection } from '@/shared/workspace/connection';

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
export function useServiceUpdate(connection: Connection) {
  const query = useQuery(serviceUpdateQueryOptions(connection));
  return {
    data: query.data,
    error: query.error,
    unreachable: query.isRefetchError,
  };
}
