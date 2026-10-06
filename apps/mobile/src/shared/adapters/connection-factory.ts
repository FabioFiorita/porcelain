import { Effect, Layer } from 'effect';
import { openRemoteConnection } from '@porcelain/client/live';
import { OperationStorage } from '@porcelain/client/git-actions';
import {
  AccessPlatform,
  RemoteConnectionFactory,
} from '@porcelain/client/access';
import { operationStorage } from './operation-storage';
import { mobileSocket } from './live-socket';
import { cryptoLayer } from './crypto';
import { REQUEST_TIMEOUT_MS } from '../../config/limits';

export function remoteConnectionFactoryLayer(memoMap: Layer.MemoMap) {
  return Layer.effect(
    RemoteConnectionFactory,
    Effect.gen(function* () {
      const platform = yield* AccessPlatform;
      return RemoteConnectionFactory.of({
        open: (remote) =>
          Effect.acquireRelease(
            Effect.sync(() =>
              openRemoteConnection(
                {
                  ...remote,
                  send: platform.send,
                  socket: mobileSocket,
                  timeoutMs: REQUEST_TIMEOUT_MS,
                },
                Layer.merge(
                  cryptoLayer,
                  Layer.succeed(
                    OperationStorage,
                    operationStorage(
                      JSON.stringify([
                        remote.environmentId,
                        remote.address,
                        remote.deviceId,
                      ]),
                    ),
                  ),
                ),
                memoMap,
              ),
            ),
            (connection) => Effect.promise(() => connection.close()),
          ),
      });
    }),
  );
}
