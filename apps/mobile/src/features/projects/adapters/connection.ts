import { Layer } from 'effect';
import { openRemoteConnection } from '@porcelain/client/live';
import { OperationStorage } from '@porcelain/client/git-actions';
import type { AccessPlatformValue } from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import { operationStorage } from './operation-storage';
import { mobileSocket } from '../../../shared/adapters/live-socket';
import { cryptoLayer } from './crypto';
import { REQUEST_TIMEOUT_MS } from '../../../config/limits';
import { applicationMemoMap } from '../../../shared/application/store';

export function createProjectConnection(
  input: Pick<
    Remote,
    'environmentId' | 'address' | 'credential' | 'deviceId'
  > & { send: AccessPlatformValue['send'] },
) {
  const connection = openRemoteConnection(
    {
      ...input,
      socket: mobileSocket,
      timeoutMs: REQUEST_TIMEOUT_MS,
    },
    Layer.merge(
      cryptoLayer,
      Layer.succeed(
        OperationStorage,
        operationStorage(
          JSON.stringify([input.environmentId, input.address, input.deviceId]),
        ),
      ),
    ),
    applicationMemoMap,
  );
  return {
    connection,
    close: () => {
      void connection.close();
    },
  };
}
