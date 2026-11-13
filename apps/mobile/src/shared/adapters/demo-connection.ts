import { Effect, Layer } from 'effect';
import { liveSessionState, openLiveConnection } from '@porcelain/client/live';
import { OperationStorage } from '@porcelain/client/git-actions';
import type { Remote } from '@porcelain/client/access/rules';
import { secureRandomLayer } from './secure-random';
import { createDemoTransport } from './demo-transport';
import { REQUEST_TIMEOUT_MS } from '../../config/limits';

export function openDemoConnection(remote: Remote, memoMap: Layer.MemoMap) {
  const state = liveSessionState();
  state.set('connected');
  return openLiveConnection(
    {
      environmentId: remote.environmentId,
      address: remote.address,
      cacheIdentity: [remote.address, remote.deviceId ?? ''],
      timeoutMs: REQUEST_TIMEOUT_MS,
      transport: createDemoTransport(),
      liveUpdates: {
        state,
        connect: () => Effect.succeed({ subscribe: () => undefined }),
      },
    },
    Layer.merge(
      secureRandomLayer,
      Layer.succeed(OperationStorage, {
        read: () => Effect.succeed(null),
        write: () => Effect.void,
        clear: () => Effect.void,
      }),
    ),
    memoMap,
  );
}
