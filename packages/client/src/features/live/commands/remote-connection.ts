import { Context, Effect, Equal, Layer } from 'effect';
import { OperationStore } from '../../git-actions/store/operations.ts';
import type { Remote } from '../../access/rules/remotes.ts';
import type { AccessPlatform } from '../../access/ports/access-platform.ts';
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
      readonly send: AccessPlatform['send'];
      readonly timeoutMs: number;
      readonly socket: Parameters<typeof remoteLiveUpdates>[2];
    },
  ): Layer.Layer<RemoteConnection, never, OperationStore> {
    return Layer.effect(
      RemoteConnection,
      Effect.gen(function* () {
        const operations = yield* OperationStore;
        const lifetime = yield* Effect.acquireRelease(
          Effect.sync(() =>
            createWorktreeConnection({
              environmentId: input.environmentId,
              transport: remoteTransport(
                input.address,
                input.credential,
                input.send,
              ),
              cacheIdentity: [input.address, input.deviceId ?? ''],
              timeoutMs: input.timeoutMs,
            }),
          ),
          (connection) => Effect.promise(connection.close),
        );
        return Equal.byReference({
          ...lifetime.connection,
          controller: lifetime.controller,
          operations,
          liveUpdates: remoteLiveUpdates(
            input.address,
            lifetime.connection.transport,
            input.socket,
          ),
        });
      }),
    );
  }
}
