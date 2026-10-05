import { Effect, Option } from 'effect';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import type { Query, QueryFunctionContext } from '@tanstack/query-core';
import {
  REMOTE_STATUS_REFRESH_MS,
  REMOTE_STATUS_TIMEOUT_MS,
} from '../../../config/limits.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import {
  requestEffect,
  runRequest,
} from '../../../shared/api/effect-client.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
import {
  remoteTransport,
  type Transport,
} from '../../../shared/api/transport.ts';
import type { AccessPlatform } from '../ports/access-platform.ts';
import {
  remoteStatus,
  type Remote,
  type RemoteAnswer,
} from '../rules/remotes.ts';
import { accessApi } from '../api.ts';

export function readRemoteEnvironment(
  transport: Transport,
  environmentId: string,
): Effect.Effect<RemoteAnswer> {
  const api = accessApi({ transport });
  return Effect.gen(function* () {
    const environment = yield* requestEffect(
      api.publicAccess.readEnvironment(),
    );
    if (
      environment.environmentId === environmentId &&
      environment.protocol === ENVIRONMENT_PROTOCOL
    )
      yield* requestEffect(api.session.readSession());
    return { kind: 'described' as const, environment };
  }).pipe(
    Effect.catch((error) =>
      Effect.succeed<RemoteAnswer>(
        error instanceof RequestError && error.status === 401
          ? { kind: 'unauthorized' }
          : { kind: 'unreachable' },
      ),
    ),
    Effect.timeoutOption(REMOTE_STATUS_TIMEOUT_MS),
    Effect.map((result) =>
      Option.getOrElse(result, (): RemoteAnswer => ({ kind: 'unreachable' })),
    ),
  );
}

export function remoteStatusQueryOptions(
  platform: AccessPlatform,
  remote: Remote,
) {
  return {
    queryKey: queryKeys.remoteStatus(remote.environmentId, remote.address),
    queryFn: ({ signal }: QueryFunctionContext) =>
      runRequest(
        readRemoteEnvironment(
          remoteTransport(remote.address, remote.credential, platform.send),
          remote.environmentId,
        ),
        signal,
      ),
    refetchInterval: (query: Query<RemoteAnswer>) =>
      remoteStatus(remote, query.state.data).kind === 'other-server'
        ? false
        : REMOTE_STATUS_REFRESH_MS,
    retry: false,
  };
}

export function environmentQueryOptions(
  platform: AccessPlatform,
  remote: Remote,
) {
  const status = remoteStatusQueryOptions(platform, remote);
  return {
    ...status,
    queryKey: queryKeys.environment(
      remote.environmentId,
      remote.address,
      remote.deviceId,
    ),
    select: (answer: RemoteAnswer) => remoteStatus(remote, answer),
  };
}
