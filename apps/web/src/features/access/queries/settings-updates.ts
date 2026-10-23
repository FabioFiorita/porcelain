import {
  useAtom,
  useAtomMount,
  useAtomSet,
  useAtomValue,
} from '@effect/atom-react';
import { Cause, Effect, Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import {
  readRemoteStatus,
  readServiceUpdate,
  serviceUpdateSnapshot,
  remoteStatusResult,
  runSettingsUpdates,
  settingsUpdateBatch,
  settingsUpdateCount,
  SettingsUpdateError,
  type SettingsUpdateTarget,
} from '@porcelain/client/access';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { noUpdateMessage, type AppUpdateState } from '../rules/app-update';
import { readInventory } from '@porcelain/client/projects';
import { DesktopHost } from '@/shared/adapters/desktop';
import {
  accessSession,
  localDeviceId,
  pairingPlatform,
  remoteConnectionState,
} from '../store';
import {
  appUpdate,
  appUpdateState,
  desktopCapabilities,
  type useAppUpdate,
} from './app-update';

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

const updateRows = Atom.make((get) => {
  get.addFinalizer(accessSession.state.subscribe(() => get.refreshSelf()));
  get.addFinalizer(remoteConnectionState.subscribe(() => get.refreshSelf()));
  const rows: SettingsUpdateRow[] = [];
  const failures: { id: string; name: string; message: string }[] = [];
  let checking = false;
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
      checking ||= check.waiting;
      const error = appCheckError(state, check);
      if (error)
        failures.push({ id: 'mac-app', name: 'Mac app', message: error });
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
            available:
              AsyncResult.isSuccess(check) &&
              state?.status === 'available' &&
              !check.waiting,
            latest: state && 'version' in state ? state.version : undefined,
            update: install,
          },
        });
    } else {
      const result = get(readServiceUpdate(local));
      checking ||= result.waiting;
      if (AsyncResult.isFailure(result))
        failures.push({
          id: local.environmentId,
          name: 'This computer',
          message: connectionErrorMessage(Cause.squash(result.cause)),
        });
      const state = serviceUpdateSnapshot(result);
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
    if (connection.activeRoute)
      get.addFinalizer(
        connection.activeRoute.subscribe(() => get.refreshSelf()),
      );
    const status = remoteStatusResult(
      remote,
      get(readRemoteStatus(pairingPlatform, remote)),
    );
    if (status.kind !== 'online') continue;
    const result = get(readServiceUpdate(connection));
    checking ||= result.waiting;
    if (AsyncResult.isFailure(result))
      failures.push({
        id: remote.environmentId,
        name: status.name,
        message: connectionErrorMessage(Cause.squash(result.cause)),
      });
    const state = serviceUpdateSnapshot(result);
    if (state)
      rows.push({
        current: state.version,
        target: {
          kind: 'service',
          id: remote.environmentId,
          name: status.name,
          connection,
          state,
          deviceId: connection.activeRoute?.value?.deviceId ?? remote.deviceId,
        },
      });
  }
  return { rows, failures, checking };
});

const refreshSettingsUpdates = Atom.fnSync((mode: 'entry' | 'retry', get) => {
  const local = accessSession.state.value.connection;
  const capabilities = Option.getOrUndefined(
    AsyncResult.value(get(desktopCapabilities)),
  );
  if (
    mode === 'retry' &&
    capabilities?.isDesktopShell &&
    !get(appUpdate).waiting
  )
    get.refresh(appUpdate);
  const connections = new Set([
    ...(local && !capabilities?.isDesktopShell ? [local] : []),
    ...remoteConnectionState.value.map(({ connection }) => connection),
  ]);
  for (const connection of connections) {
    const atom = readServiceUpdate(connection);
    if (!get(atom).waiting) get.refresh(atom);
  }
});

const settingsUpdatesEntry = Atom.make((get) => {
  const capabilities = get(desktopCapabilities);
  if (AsyncResult.isSuccess(capabilities))
    get.set(refreshSettingsUpdates, 'entry');
}).pipe(Atom.setIdleTTL(0));

export function useSettingsUpdatesEntry() {
  useAtomMount(settingsUpdatesEntry);
}

export function useSettingsUpdates() {
  const { rows, failures, checking } = useAtomValue(updateRows);
  const refresh = useAtomSet(refreshSettingsUpdates);
  const batch = useAtomValue(settingsUpdateBatch);
  const [result, run] = useAtom(runSettingsUpdates);
  const targets = rows.map((row) => row.target);
  return {
    rows,
    failures,
    checking,
    refresh: () => refresh('entry'),
    retry: () => refresh('retry'),
    batch,
    result,
    run,
    targets,
    count: settingsUpdateCount(targets),
  };
}

function appCheckError(
  state: AppUpdateState | undefined,
  check: ReturnType<typeof useAppUpdate>['result'],
) {
  if (state?.status === 'error') return state.message;
  if (!check.waiting && AsyncResult.isFailure(check))
    return connectionErrorMessage(Cause.squash(check.cause));
  return undefined;
}
