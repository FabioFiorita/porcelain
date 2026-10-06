import { Context, Effect, Equal, Layer } from 'effect';
import { OperationStore } from '../../git-actions/store/operations.ts';
import { FileDrafts } from '../../files/store.ts';
import type { Remote } from '../../access/rules/remotes.ts';
import type { AccessPlatformValue } from '../../access/ports/access-platform.ts';
import { createWorktreeConnection } from '../../../shared/api/worktree-connection.ts';
import { remoteTransport } from '../../../shared/api/transport.ts';
import { remoteLiveUpdates } from './remote-live-updates.ts';
import type { LiveConnection } from './live-queries.ts';

export class RemoteConnection extends Context.Service<
  RemoteConnection,
  LiveConnection
>()('@porcelain/client/RemoteConnection') {
  static layer(
    input: Pick<
      Remote,
      'environmentId' | 'address' | 'credential' | 'deviceId'
    > & {
      readonly cryptoLayer: LiveConnection['cryptoLayer'];
      readonly send: AccessPlatformValue['send'];
      readonly timeoutMs: number;
      readonly socket: Parameters<typeof remoteLiveUpdates>[2];
      readonly memoMap?: Layer.MemoMap;
    },
  ): Layer.Layer<RemoteConnection, never, OperationStore | FileDrafts> {
    return Layer.effect(
      RemoteConnection,
      Effect.gen(function* () {
        const operations = yield* OperationStore;
        const drafts = yield* FileDrafts;
        const lifetime = yield* Effect.acquireRelease(
          Effect.sync(() =>
            createWorktreeConnection(
              {
                environmentId: input.environmentId,
                transport: remoteTransport(
                  input.address,
                  input.credential,
                  input.send,
                ),
                cacheIdentity: [input.address, input.deviceId ?? ''],
                timeoutMs: input.timeoutMs,
              },
              input.memoMap,
            ),
          ),
          (connection) => Effect.promise(connection.close),
        );
        const connection = Equal.byReference({
          ...lifetime.connection,
          controller: lifetime.controller,
          operations,
          cryptoLayer: input.cryptoLayer,
          liveUpdates: remoteLiveUpdates(
            input.address,
            lifetime.connection.transport,
            input.socket,
          ),
        });
        drafts.adopt(connection);
        return connection;
      }),
    );
  }
}
