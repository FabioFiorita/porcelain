import { operationStoreLayer } from '../../git-actions/store/operations.ts';
import { Equal, Layer, type Crypto } from 'effect';
import { OperationStore } from '../../git-actions/ports/operation-store.ts';
import type { OperationStorage } from '../../git-actions/ports/operation-storage.ts';
import { FileDrafts } from '../../files/store.ts';
import { createWorktreeConnection } from '../../../shared/api/worktree-connection.ts';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import type { LiveConnection } from '../ports/connection.ts';
import type { Remote } from '../../access/rules/remotes.ts';
import type { AccessPlatformValue } from '../../access/ports/access-platform.ts';
import { remoteTransport } from '../../../shared/api/transport.ts';
import { remoteLiveUpdates } from './remote-live-updates.ts';

export function openLiveConnection(
  input: Omit<WorktreeConnection, 'request' | 'scope' | 'isClosed'> & {
    readonly address: string;
    readonly timeoutMs: number;
    readonly liveUpdates: LiveConnection['liveUpdates'];
  },
  platform: Layer.Layer<OperationStorage | Crypto.Crypto>,
  memoMap: Layer.MemoMap,
): LiveConnection & { readonly address: string } {
  const services = Layer.merge(
    Layer.fresh(operationStoreLayer),
    FileDrafts.layer,
  ).pipe(Layer.provideMerge(platform));
  const { connection: requests } = createWorktreeConnection(
    input,
    memoMap,
    services,
  );
  const connection = Equal.byReference({
    ...requests,
    address: input.address,
    liveUpdates: input.liveUpdates,
    operations: requests.runtime.runSync(OperationStore),
  });
  requests.runtime.runSync(FileDrafts).adopt(connection);
  return connection;
}

export function openRemoteConnection(
  input: Pick<
    Remote,
    'environmentId' | 'address' | 'credential' | 'deviceId'
  > & {
    readonly send: AccessPlatformValue['send'];
    readonly socket: Parameters<typeof remoteLiveUpdates>[2];
    readonly timeoutMs: number;
  },
  platform: Layer.Layer<OperationStorage | Crypto.Crypto>,
  memoMap: Layer.MemoMap,
) {
  const transport = remoteTransport(
    input.address,
    input.credential,
    input.send,
  );
  return openLiveConnection(
    {
      environmentId: input.environmentId,
      address: input.address,
      transport,
      cacheIdentity: [input.address, input.deviceId ?? ''],
      liveUpdates: remoteLiveUpdates(input.address, transport, input.socket),
      timeoutMs: input.timeoutMs,
    },
    platform,
    memoMap,
  );
}
