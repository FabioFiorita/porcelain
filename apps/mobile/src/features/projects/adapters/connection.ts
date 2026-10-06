import { Layer, ManagedRuntime } from 'effect';
import { RemoteConnection } from '@porcelain/client/live';
import {
  OperationStore,
  OperationStorage,
} from '@porcelain/client/git-actions';
import type { AccessPlatformValue } from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import { operationStorage } from './operation-storage';
import { mobileSocket } from '../../../shared/adapters/live-socket';
import { cryptoLayer } from './crypto';
import { REQUEST_TIMEOUT_MS } from '../../../config/limits';

export function createProjectConnection(
  input: Pick<
    Remote,
    'environmentId' | 'address' | 'credential' | 'deviceId'
  > & { send: AccessPlatformValue['send'] },
) {
  const runtime = ManagedRuntime.make(
    RemoteConnection.layer({
      ...input,
      socket: mobileSocket,
      cryptoLayer,
      timeoutMs: REQUEST_TIMEOUT_MS,
    }).pipe(
      Layer.provide(OperationStore.layer),
      Layer.provide(
        Layer.succeed(
          OperationStorage,
          operationStorage(
            JSON.stringify([
              input.environmentId,
              input.address,
              input.deviceId,
            ]),
          ),
        ),
      ),
    ),
  );
  const connection = runtime.runSync(RemoteConnection);
  return {
    connection,
    close: () => {
      void runtime.dispose();
    },
  };
}
