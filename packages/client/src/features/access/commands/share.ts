import type { QueryClient } from '@tanstack/query-core';
import type { SetRemoteAccessRequest } from '@porcelain/contracts/access';
import { Effect } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { createScopedWriteQueues } from '../../../shared/api/write-queue.ts';
import { accessApi } from '../api.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';

const writeQueue = createScopedWriteQueues();

export function shareCommands(
  connection: WorktreeConnection,
  client: QueryClient,
) {
  const api = accessApi(connection);
  const accessKey = queryKeys.pairedAccess(connection.environmentId);
  const remoteKey = queryKeys.remoteAccess(connection.environmentId);
  const updateKey = queryKeys.serviceUpdate(connection.environmentId);
  function run<A, E, P>(
    key: readonly unknown[],
    send: (signal: AbortSignal) => Effect.Effect<A, E>,
    publish: (answer: A, signal: AbortSignal) => Effect.Effect<void, P>,
  ) {
    return writeQueue(connection, key).enqueue(
      Effect.gen(function* () {
        const request = connection.request();
        yield* currentAnswerEffect(request.signal);
        const answer = yield* send(request.signal);
        yield* currentAnswerEffect(request.signal);
        yield* publish(answer, request.signal);
        return answer;
      }),
    );
  }
  function refresh(key: readonly unknown[], signal: AbortSignal) {
    return Effect.suspend(() =>
      signal.aborted
        ? Effect.void
        : nativeOperation(() => client.invalidateQueries({ queryKey: key })),
    );
  }
  function cache(
    key: readonly unknown[],
    answer: unknown,
    signal: AbortSignal,
  ) {
    return Effect.gen(function* () {
      yield* nativeOperation(() => client.cancelQueries({ queryKey: key }));
      yield* currentAnswerEffect(signal);
      client.setQueryData(key, answer);
    });
  }
  return {
    issue: (input: { label: string; addresses: string[]; trusted: boolean }) =>
      run(
        accessKey,
        (signal) =>
          requestEffect(
            api.administration.issuePairing({
              payload: {
                labels: [input.label],
                addresses: input.addresses,
                ...(input.trusted ? { trusted: true } : {}),
              },
            }),
            signal,
          ),
        (_answer, signal) => refresh(accessKey, signal),
      ),
    revoke: (id: string) =>
      run(
        accessKey,
        (signal) =>
          requestEffect(
            api.administration.revokeAccess({ payload: { id } }),
            signal,
          ).pipe(Effect.ensuring(refresh(accessKey, signal))),
        () => Effect.void,
      ),
    trust: (input: { id: string; trusted: boolean }) =>
      run(
        accessKey,
        (signal) =>
          requestEffect(
            api.administration.setDeviceTrust({ payload: input }),
            signal,
          ).pipe(Effect.ensuring(refresh(accessKey, signal))),
        () => Effect.void,
      ),
    setRemote: (change: SetRemoteAccessRequest) =>
      run(
        remoteKey,
        (signal) =>
          requestEffect(
            api.administration.setRemoteAccess({ payload: change }),
            signal,
          ),
        (answer, signal) => cache(remoteKey, answer, signal),
      ),
    rename: (name: string | null) =>
      run(
        queryKeys.inventory(connection.environmentId),
        (signal) =>
          requestEffect(
            api.environmentName.renameEnvironment({ payload: { name } }),
            signal,
          ),
        (_answer, signal) =>
          refresh(queryKeys.inventory(connection.environmentId), signal),
      ),
    startServiceUpdate: (version: string) =>
      run(
        updateKey,
        (signal) =>
          requestEffect(
            api.serviceUpdates.startServiceUpdate({ payload: { version } }),
            signal,
          ).pipe(Effect.tapError(() => refresh(updateKey, signal))),
        (answer, signal) => cache(updateKey, answer, signal),
      ),
  };
}
