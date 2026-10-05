import { Effect, Schema } from 'effect';
import type { QueryFunctionContext } from '@tanstack/query-core';
import type { Transport } from '../../../shared/api/transport.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
import {
  requestEffect,
  runRequest,
} from '../../../shared/api/effect-client.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { BrowserSession } from '../rules/browser-session.ts';
import { accessApi } from '../api.ts';
import { projectsApi } from '../../projects/api.ts';

export function sessionQueryOptions(transport: Transport) {
  return {
    queryKey: queryKeys.session(),
    queryFn: ({ signal }: Pick<QueryFunctionContext, 'signal'>) =>
      runRequest(
        Effect.gen(function* () {
          const principal = yield* requestEffect(
            accessApi({ transport }).session.readSession(),
          );
          const inventory = yield* requestEffect(
            projectsApi({ transport }).readInventory(),
          );
          return { principal, inventory } satisfies BrowserSession;
        }).pipe(
          Effect.catch((error) =>
            error instanceof RequestError && error.status === 401
              ? Effect.succeed(null)
              : Effect.fail(
                  error instanceof RequestError || Schema.isSchemaError(error)
                    ? new ConnectionError({
                        message:
                          'Could not reach Porcelain to restore this browser session.',
                        cause: error,
                      })
                    : error,
                ),
          ),
        ),
        signal,
      ),
  };
}
