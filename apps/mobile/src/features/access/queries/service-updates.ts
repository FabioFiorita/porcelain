import { useAtomValue, useAtomSet } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import {
  readServiceUpdate,
  settingsUpdatesVisible,
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
    const target: ServiceUpdateTarget | undefined = state
      ? {
          kind: 'service',
          id: remote.environmentId,
          name: remote.name,
          connection,
          state,
          deviceId: connection.activeRoute?.value?.deviceId ?? remote.deviceId,
        }
      : undefined;
    return {
      remote,
      connection,
      result,
      target,
      confirmed: AsyncResult.isSuccess(result),
    };
  });
});

const refreshServiceUpdates = Atom.fnSync((_: void, get) => {
  for (const { connection } of remoteConnectionState.value) {
    const update = readServiceUpdate(connection);
    if (!get(update).waiting) get.refresh(update);
  }
});

export function useServiceUpdates() {
  const rows = useAtomValue(serviceUpdates);
  const refresh = useAtomSet(refreshServiceUpdates);
  return {
    rows,
    checking: rows.some((row) => row.result.waiting),
    refresh: () => refresh(undefined),
    targets: rows.flatMap((row) =>
      row.target && row.confirmed ? [row.target] : [],
    ),
    failed: rows.some((row) => AsyncResult.isFailure(row.result)),
  };
}

export function useUpdatesIndicator() {
  const { targets } = useServiceUpdates();
  const batch = useAtomValue(settingsUpdateBatch);
  return {
    running: batch.running,
    visible: settingsUpdatesVisible(targets, batch),
  };
}
