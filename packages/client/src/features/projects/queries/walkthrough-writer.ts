import { Effect } from 'effect';
import { AsyncResult, Atom, Reactivity } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import {
  walkthroughWriterChoiceStatus,
  walkthroughWriterStatus,
  type WriterSettings,
} from '../rules/walkthrough-writer.ts';

function walkthroughWriterCheck<E>(
  result: AsyncResult.AsyncResult<WriterSettings, E>,
) {
  const settings = AsyncResult.isSuccess(result) ? result.value : undefined;
  return {
    status: settings && walkthroughWriterStatus(settings),
    failed: AsyncResult.isFailure(result),
    noWriters: settings?.models.length === 0,
  };
}

export function walkthroughWriterChoice<E>(
  result: AsyncResult.AsyncResult<WriterSettings, E>,
  next: WriterSettings['writer'] | undefined,
) {
  const settings = AsyncResult.isSuccess(result) ? result.value : undefined;
  const check = walkthroughWriterCheck(result);
  return {
    ...check,
    status:
      next && settings
        ? walkthroughWriterChoiceStatus(next, settings.models)
        : check.status,
    settings,
    writer: next ?? settings?.writer,
    next,
  };
}

const writerSettings = Atom.family((connection: RuntimeConnection) =>
  Atom.family((projectId: string | undefined) =>
    clientRuntime(connection)
      .atom(
        requestApi(connection, (api) =>
          api.walkthroughs.readWalkthroughWriterSettings({
            query: { projectId },
          }),
        ),
      )
      .pipe(
        connection.atoms.withReactivity([
          queryKeys.inventory(connection.environmentId),
          queryKeys.walkthroughWriterCatalog(connection.environmentId),
        ]),
        Atom.setIdleTTL(0),
      ),
  ),
);

export function readWalkthroughWriterSettings(
  connection: RuntimeConnection,
  projectId?: string,
) {
  return writerSettings(connection)(projectId);
}

export function refreshWalkthroughWriterCatalog(connection: RuntimeConnection) {
  return requestApi(connection, (api) =>
    api.walkthroughs.readWalkthroughWriterSettings({
      query: { refresh: 'true' },
    }),
  ).pipe(
    Effect.ensuring(
      Reactivity.invalidate([
        queryKeys.walkthroughWriterCatalog(connection.environmentId),
      ]),
    ),
  );
}

export const recheckWalkthroughWriterSettings = Atom.family(
  (connection: RuntimeConnection) =>
    clientRuntime(connection).fn((_: void) =>
      refreshWalkthroughWriterCatalog(connection),
    ),
);
