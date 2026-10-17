import { operationStoreLayer } from '../../git-actions/store/operations.ts';
import type { AtomRef } from 'effect/reactivity';
import type { StatusActivity } from '../../access/ports/status-activity.ts';
import { createRouteTransport } from '../../access/store/route-transport.ts';
import type { ConnectionRoute } from '../../access/rules/remotes.ts';
import { Equal, Layer, type Crypto } from 'effect';
import { OperationStore } from '../../git-actions/ports/operation-store.ts';
import type { OperationStorage } from '../../git-actions/ports/operation-storage.ts';
import { FileDrafts } from '../../files/store.ts';
import { createWorktreeConnection } from '../../../shared/api/worktree-connection.ts';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import type { LiveConnection } from '../ports/connection.ts';
import type { Remote } from '../../access/rules/remotes.ts';
import type { AccessPlatformValue } from '../../access/ports/access-platform.ts';
import { remoteLiveUpdates } from './remote-live-updates.ts';

export function openLiveConnection(
  input: Omit<WorktreeConnection, 'request' | 'scope' | 'isClosed'> & {
    readonly address: string;
    readonly activeRoute?: AtomRef.ReadonlyRef<ConnectionRoute | undefined>;
    readonly timeoutMs: number;
    readonly liveUpdates: LiveConnection['liveUpdates'];
    readonly onStatusChange?: (() => void) | undefined;
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
    get address() {
      return input.activeRoute?.value?.address ?? input.address;
    },
    ...(input.activeRoute ? { activeRoute: input.activeRoute } : {}),
    liveUpdates: input.liveUpdates,
    ...(input.onStatusChange ? { onStatusChange: input.onStatusChange } : {}),
    operations: requests.runtime.runSync(OperationStore),
  });
  requests.runtime.runSync(FileDrafts).adopt(connection);
  return connection;
}

export function openRemoteConnection(
  input: Pick<
    Remote,
    'environmentId' | 'address' | 'credential' | 'deviceId' | 'alternateRoutes'
  > & {
    readonly send: AccessPlatformValue['send'];
    readonly activity?: StatusActivity;
    readonly onStatusChange?: (() => void) | undefined;
    readonly socket: Parameters<typeof remoteLiveUpdates>[2];
    readonly timeoutMs: number;
  },
  platform: Layer.Layer<OperationStorage | Crypto.Crypto>,
  memoMap: Layer.MemoMap,
) {
  const routing = createRouteTransport({ ...input, name: '' }, input.send);
  const transport = routing.transport;
  return openLiveConnection(
    {
      environmentId: input.environmentId,
      address: input.address,
      transport,
      cacheIdentity: [input.address, input.deviceId ?? ''],
      activeRoute: routing.active,
      liveUpdates: remoteLiveUpdates(
        input.address,
        transport,
        input.socket,
        routing,
        input.activity,
      ),
      ...(input.onStatusChange ? { onStatusChange: input.onStatusChange } : {}),
      timeoutMs: input.timeoutMs,
    },
    platform,
    memoMap,
  );
}
