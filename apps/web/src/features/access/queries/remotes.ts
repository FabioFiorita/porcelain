import { Option, Stream } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { RemoteStatus } from '@porcelain/client/access/rules';
import { useAtomValue } from '@effect/atom-react';
import {
  readRemoteConnectionStatus,
  type RemoteConnection,
} from '@porcelain/client/access';
import { readWorktreeSnapshot } from '@porcelain/client/projects';
import type { Remote } from '@porcelain/client/access/rules';
import {
  environmentRuntime,
  pairingPlatform,
  remoteConnectionState,
  useRemoteConnection,
} from '../store';

export function useRemoteStatus(remote: Remote) {
  const entry = useRemoteConnection(remote.environmentId);
  return useAtomValue(
    readRemoteConnectionStatus(pairingPlatform, remote, entry?.connection),
  );
}

export const remoteConnectionStatus = Atom.family((environmentId: string) =>
  Atom.readable((get): RemoteStatus => {
    get.addFinalizer(remoteConnectionState.subscribe(() => get.refreshSelf()));
    const entry = remoteConnectionState.value.find(
      (candidate) => candidate.remote.environmentId === environmentId,
    );
    return entry
      ? get(
          readRemoteConnectionStatus(
            pairingPlatform,
            entry.remote,
            entry.connection,
          ),
        )
      : { kind: 'offline' };
  }),
);

export const shownRemoteWorkspace = Atom.family((_environmentId: string) =>
  Atom.make(false).pipe(Atom.keepAlive),
);

export const rememberRemoteWorkspace = Atom.family((environmentId: string) =>
  Atom.make((get) => get.set(shownRemoteWorkspace(environmentId), true)),
);

const computerSnapshot = Atom.family((computer: RemoteConnection) =>
  environmentRuntime
    .atom(Stream.unwrap(readWorktreeSnapshot(computer)))
    .pipe(Atom.setIdleTTL(0)),
);

export const remoteWorktreeSnapshots = Atom.family(
  (computers: readonly RemoteConnection[]) =>
    Atom.readable((get) =>
      computers.flatMap((computer) => {
        const snapshot = Option.getOrUndefined(
          AsyncResult.value(get(computerSnapshot(computer))),
        );
        return snapshot
          ? [{ environmentId: computer.remote.environmentId, snapshot }]
          : [];
      }),
    ),
);
