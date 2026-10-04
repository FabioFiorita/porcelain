import { CancelledError, type QueryClient } from '@tanstack/query-core';
import type { ReadChangesResponse } from '@porcelain/contracts/changes';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { changesQueryOptions } from '../queries/changes.ts';

export async function readCurrentChanges(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  client: QueryClient,
): Promise<ReadChangesResponse> {
  const options = client.defaultQueryOptions({
    ...changesQueryOptions(scope, connection),
    staleTime: 0,
  });
  if (options.retry === undefined) options.retry = false;
  const cache = client.getQueryCache();
  const query = cache.build(client, options);
  let settled = false;
  let unsubscribe = () => {};
  try {
    const result = await new Promise<{ changes: ReadChangesResponse }>(
      (resolve, reject) => {
        const followed = new Set<Promise<{ changes: ReadChangesResponse }>>();
        const fail = (error: unknown) => {
          settled = true;
          reject(error);
        };
        const failed = (
          promise: Promise<{ changes: ReadChangesResponse }>,
          error: unknown,
        ) => {
          if (settled) return;
          const replacement = query.promise;
          if (
            error instanceof CancelledError &&
            error.silent &&
            replacement &&
            replacement !== promise
          ) {
            follow(replacement);
          } else fail(error);
        };
        const follow = (promise: Promise<{ changes: ReadChangesResponse }>) => {
          if (followed.has(promise)) return;
          followed.add(promise);
          void promise.then(
            (answer) => {
              if (settled) return;
              settled = true;
              resolve(answer);
            },
            (error: unknown) => failed(promise, error),
          );
        };
        unsubscribe = cache.subscribe((event) => {
          if (settled || event.query !== query) return;
          if (event.type === 'removed') fail(new CancelledError());
          if (event.type !== 'updated') return;
          if (
            event.action.type === 'setState' &&
            event.action.state.fetchStatus === 'idle'
          ) {
            fail(new CancelledError());
          }
          if (event.action.type === 'error') fail(event.action.error);
          if (event.action.type === 'success' && !event.action.manual) {
            if (query.promise) follow(query.promise);
          }
        });
        const fetched = query.fetch(options);
        void fetched.catch((error: unknown) => failed(fetched, error));
        if (query.promise) follow(query.promise);
      },
    );
    return result.changes;
  } finally {
    unsubscribe();
  }
}
