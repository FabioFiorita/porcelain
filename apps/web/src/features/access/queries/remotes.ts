import { Effect, Stream } from 'effect';
import { AsyncResult, Atom, AtomRegistry } from 'effect/reactivity';
import type { RemoteStatus } from '@porcelain/client/access/rules';
import { useAtomValue } from '@effect/atom-react';
import { readRemoteConnectionStatus } from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import {
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

export function remoteWorktreeInterrupted(kind: RemoteStatus['kind']) {
  return kind === 'checking' || kind === 'reconnecting' || kind === 'offline';
}

export const shownRemoteWorkspace = Atom.family((_environmentId: string) =>
  Atom.make(false).pipe(Atom.keepAlive),
);

export const rememberRemoteWorkspace = Atom.family((environmentId: string) =>
  Atom.make((get) => get.set(shownRemoteWorkspace(environmentId), true)),
);

const interruption = Atom.family((status: Atom.Atom<RemoteStatus>) =>
  status.pipe(Atom.map(({ kind }) => remoteWorktreeInterrupted(kind))),
);

export const remoteWorkspaceNotice = Atom.family(
  (status: Atom.Atom<RemoteStatus>) =>
    Atom.make((get) =>
      AtomRegistry.toStream(get.registry, interruption(status)).pipe(
        Stream.switchMap((interrupted) =>
          interrupted
            ? Stream.concat(
                Stream.make(false),
                Stream.fromEffect(Effect.as(Effect.sleep('2 seconds'), true)),
              )
            : Stream.make(false),
        ),
      ),
    ).pipe(
      Atom.map((result) => AsyncResult.getOrElse(result, () => false)),
      Atom.setIdleTTL(0),
    ),
);
