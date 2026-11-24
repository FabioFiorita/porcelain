import { Effect } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import {
  walkthroughWriterStatus,
  type WriterSettings,
} from '../rules/walkthrough-writer.ts';

export function walkthroughWriterCheck<E>(
  result: AsyncResult.AsyncResult<WriterSettings, E>,
) {
  const settings = AsyncResult.isSuccess(result) ? result.value : undefined;
  return {
    status: settings && walkthroughWriterStatus(settings),
    failed: AsyncResult.isFailure(result),
    noWriters: settings?.models.length === 0,
  };
}

const writerSettings = Atom.family((connection: RuntimeConnection) =>
  Atom.family((projectId: string | undefined) => {
    const runtime = clientRuntime(connection);
    const lookup = (refresh?: 'true') =>
      requestApi(connection, (api) =>
        api.walkthroughs.readWalkthroughWriterSettings({
          query: { projectId, refresh },
        }),
      );
    const read = runtime
      .atom(lookup())
      .pipe(
        connection.atoms.withReactivity([
          queryKeys.inventory(connection.environmentId),
        ]),
        Atom.setIdleTTL(0),
      );
    const recheck = runtime.fn((_: void, get) =>
      lookup('true').pipe(
        Effect.ensuring(Effect.sync(() => get.refresh(read))),
      ),
    );
    return { read, recheck };
  }),
);

export function readWalkthroughWriterSettings(
  connection: RuntimeConnection,
  projectId?: string,
) {
  return writerSettings(connection)(projectId).read;
}

export function recheckWalkthroughWriterSettings(
  connection: RuntimeConnection,
  projectId?: string,
) {
  return writerSettings(connection)(projectId).recheck;
}
