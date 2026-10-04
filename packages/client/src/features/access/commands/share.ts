import type { QueryClient } from '@tanstack/query-core';
import type { SetRemoteAccessRequest } from '@porcelain/contracts/access';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { createScopedWriteQueues } from '../../../shared/api/write-queue.ts';
import { shareApi } from '../api.ts';

const writeQueue = createScopedWriteQueues();

export function shareCommands(
  connection: WorktreeConnection,
  client: QueryClient,
) {
  const api = shareApi(connection);
  const accessKey = queryKeys.pairedAccess(connection.environmentId);
  const remoteKey = queryKeys.remoteAccess(connection.environmentId);
  const updateKey = queryKeys.serviceUpdate(connection.environmentId);
  function run<T>(
    key: readonly unknown[],
    send: (signal: AbortSignal) => Promise<T>,
    publish: (answer: T, signal: AbortSignal) => Promise<void>,
  ) {
    return writeQueue(connection, key).enqueue(async () => {
      const request = connection.request();
      const answer = await send(request.signal);
      assertCurrentAnswer(request.signal);
      await publish(answer, request.signal);
      return answer;
    });
  }
  async function cache(
    key: readonly unknown[],
    answer: unknown,
    signal: AbortSignal,
  ) {
    await client.cancelQueries({ queryKey: key });
    assertCurrentAnswer(signal);
    client.setQueryData(key, answer);
  }
  return {
    issue: (input: { label: string; addresses: string[]; trusted: boolean }) =>
      run(
        accessKey,
        (signal) => api.issue({ ...input, signal }),
        async () => {
          await client.invalidateQueries({ queryKey: accessKey });
        },
      ),
    revoke: (id: string) =>
      run(
        accessKey,
        async (signal) => {
          try {
            return await api.revoke({ signal, id });
          } finally {
            if (!signal.aborted)
              await client.invalidateQueries({ queryKey: accessKey });
          }
        },
        async () => {},
      ),
    trust: (input: { id: string; trusted: boolean }) =>
      run(
        accessKey,
        async (signal) => {
          try {
            return await api.trust({ ...input, signal });
          } finally {
            if (!signal.aborted)
              await client.invalidateQueries({ queryKey: accessKey });
          }
        },
        async () => {},
      ),
    setRemote: (change: SetRemoteAccessRequest) =>
      run(
        remoteKey,
        (signal) => api.setRemote({ signal, change }),
        (answer, signal) => cache(remoteKey, answer, signal),
      ),
    rename: (name: string | null) =>
      run(
        queryKeys.inventory(connection.environmentId),
        (signal) => api.rename({ signal, name }),
        async () => {
          await client.invalidateQueries({
            queryKey: queryKeys.inventory(connection.environmentId),
          });
        },
      ),
    startServiceUpdate: (version: string) =>
      run(
        updateKey,
        async (signal) => {
          try {
            return await api.startServiceUpdate({ signal, version });
          } catch (error) {
            if (!signal.aborted)
              await client.invalidateQueries({ queryKey: updateKey });
            throw error;
          }
        },
        (answer, signal) => cache(updateKey, answer, signal),
      ),
  };
}
