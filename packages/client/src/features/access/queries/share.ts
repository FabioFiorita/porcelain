import type { Query, QueryFunctionContext } from '@tanstack/query-core';
import type {
  ReadRemoteAccessResponse,
  ReadServiceUpdateResponse,
} from '@porcelain/contracts/access';
import {
  REMOTE_ACCESS_SETTLING_POLL_MS,
  SERVICE_UPDATE_POLL_MS,
} from '../../../config/limits.ts';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { runRequest } from '../../../shared/api/effect-client.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
import { accessApi } from '../api.ts';
import { routesSettling } from '../rules/share.ts';

export function pairedAccessQueryOptions(connection: WorktreeConnection) {
  return {
    queryKey: queryKeys.pairedAccess(connection.environmentId),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await runRequest(
        accessApi(connection).administration.listAccess(),
        connected.signal,
      );
      assertCurrentAnswer(connected.signal);
      return result;
    },
  };
}
export function remoteAccessQueryOptions(connection: WorktreeConnection) {
  return {
    queryKey: queryKeys.remoteAccess(connection.environmentId),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      try {
        const result = await runRequest(
          accessApi(connection).administration.readRemoteAccess(),
          connected.signal,
        );
        assertCurrentAnswer(connected.signal);
        return result;
      } catch (error) {
        assertCurrentAnswer(connected.signal);
        if (error instanceof RequestError && error.status === 403) return null;
        throw error;
      }
    },
    refetchInterval: (query: Query<ReadRemoteAccessResponse | null>) =>
      routesSettling(query.state.data) ? REMOTE_ACCESS_SETTLING_POLL_MS : false,
  };
}
export function serviceUpdateQueryOptions(connection: WorktreeConnection) {
  return {
    queryKey: queryKeys.serviceUpdate(connection.environmentId),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await runRequest(
        accessApi(connection).serviceUpdates.readServiceUpdate(),
        connected.signal,
      );
      assertCurrentAnswer(connected.signal);
      return result;
    },
    refetchInterval: (query: Query<ReadServiceUpdateResponse>) =>
      query.state.data?.running === true ? SERVICE_UPDATE_POLL_MS : false,
    retry: false,
  };
}
