import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import {
  readServiceUpdate,
  settingsUpdateBatch,
  type ServiceUpdateTarget,
} from '@porcelain/client/access';
import { remoteConnectionState } from '../../../shared/application/store';

const serviceUpdates = Atom.make((get) => {
  get.addFinalizer(remoteConnectionState.subscribe(() => get.refreshSelf()));
  return remoteConnectionState.value.map(({ remote, connection }) => {
    if (connection.activeRoute) {
      get.addFinalizer(
        connection.activeRoute.subscribe(() => get.refreshSelf()),
      );
    }
    const result = get(readServiceUpdate(connection));
    const state = Option.getOrUndefined(AsyncResult.value(result));
    const target: ServiceUpdateTarget | undefined =
      state && AsyncResult.isSuccess(result)
        ? {
            kind: 'service',
            id: remote.environmentId,
            name: remote.name,
            connection,
            state,
            deviceId:
              connection.activeRoute?.value?.deviceId ?? remote.deviceId,
          }
        : undefined;
    return { remote, connection, result, target };
  });
});

export function useServiceUpdates() {
  const rows = useAtomValue(serviceUpdates);
  return {
    rows,
    targets: rows.flatMap((row) => (row.target ? [row.target] : [])),
  };
}

export function useUpdatesIndicator() {
  const { targets } = useServiceUpdates();
  const batch = useAtomValue(settingsUpdateBatch);
  const available = targets.some((target) => target.state.available);
  return {
    available,
    running: batch.running,
    visible: available || batch.running,
  };
}
