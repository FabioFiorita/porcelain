import { useAtom, useAtomValue } from '@effect/atom-react';
import { Cause, Effect, Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import {
  readRemoteStatus,
  readServiceUpdate,
  remoteStatusResult,
  runSettingsUpdates,
  settingsUpdateBatch,
  settingsUpdateCount,
  SettingsUpdateError,
  type SettingsUpdateTarget,
} from '@porcelain/client/access';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { noUpdateMessage } from '../rules/app-update';
import { readInventory } from '@porcelain/client/projects';
import { DesktopHost } from '@/shared/adapters/desktop';
import {
  accessSession,
  localDeviceId,
  pairingPlatform,
  remoteConnectionState,
} from '../store';
import { appUpdate, appUpdateState, desktopCapabilities } from './app-update';

export type SettingsUpdateRow = {
  target: SettingsUpdateTarget;
  current: string | undefined;
  checking?: boolean | undefined;
  error?: string | undefined;
  note?: string | undefined;
};

const appInstaller = Atom.runtime(DesktopHost.layer).atom(
  Effect.map(
    DesktopHost,
    (desktop) => (_version: string) =>
      desktop.installUpdate.pipe(
        Effect.mapError(
          (error) => new SettingsUpdateError({ message: error.message }),
        ),
      ),
  ),
);

const updateRows = Atom.make((get): readonly SettingsUpdateRow[] => {
  get.addFinalizer(accessSession.state.subscribe(() => get.refreshSelf()));
  get.addFinalizer(remoteConnectionState.subscribe(() => get.refreshSelf()));
  const rows: SettingsUpdateRow[] = [];
  const local = accessSession.state.value.connection;
  const capabilities = Option.getOrUndefined(
    AsyncResult.value(get(desktopCapabilities)),
  );
  if (local && capabilities) {
    if (capabilities.isDesktopShell) {
      const check = get(appUpdate);
      const info = Option.getOrUndefined(
        Option.flatten(AsyncResult.value(check)),
      );
      const state = Option.getOrUndefined(
        AsyncResult.value(get(appUpdateState)),
      );
      const install = Option.getOrUndefined(
        AsyncResult.value(get(appInstaller)),
      );
      if (info && install)
        rows.push({
          current: info.current,
          checking: check.waiting,
          error: appCheckError(state, check),
          note: state ? noUpdateMessage(state) : undefined,
          target: {
            kind: 'mac-app',
            id: 'mac-app',
            name: 'Mac app',
            available: state?.status === 'available' && !check.waiting,
            latest: state && 'version' in state ? state.version : undefined,
            update: install,
          },
        });
    } else {
      const state = Option.getOrUndefined(
        AsyncResult.value(get(readServiceUpdate(local))),
      );
      const inventory = Option.getOrUndefined(
        AsyncResult.value(get(readInventory(local))),
      );
      if (state)
        rows.push({
          current: state.version,
          target: {
            kind: 'service',
            id: local.environmentId,
            name: inventory?.environment.name ?? 'This computer',
            connection: local,
            state,
            deviceId: localDeviceId.value,
          },
        });
    }
  }
  for (const { remote, connection } of remoteConnectionState.value) {
    const status = remoteStatusResult(
      remote,
      get(readRemoteStatus(pairingPlatform, remote)),
    );
    if (status.kind !== 'online') continue;
    const state = Option.getOrUndefined(
      AsyncResult.value(get(readServiceUpdate(connection))),
    );
    if (state)
      rows.push({
        current: state.version,
        target: {
          kind: 'service',
          id: remote.environmentId,
          name: status.name,
          connection,
          state,
          deviceId: remote.deviceId,
        },
      });
  }
  return rows;
});

export function useSettingsUpdates() {
  const rows = useAtomValue(updateRows);
  const batch = useAtomValue(settingsUpdateBatch);
  const [result, run] = useAtom(runSettingsUpdates);
  const targets = rows.map((row) => row.target);
  return {
    rows,
    batch,
    result,
    run,
    targets,
    count: settingsUpdateCount(targets),
  };
}

function appCheckError(
  state:
    | ReturnType<typeof import('./app-update').useAppUpdateState>
    | undefined,
  check: ReturnType<typeof import('./app-update').useAppUpdate>['result'],
) {
  if (state?.status === 'error') return state.message;
  if (!check.waiting && AsyncResult.isFailure(check))
    return connectionErrorMessage(Cause.squash(check.cause));
  return undefined;
}
