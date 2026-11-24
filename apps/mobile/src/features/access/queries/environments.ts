import { remoteConnectionState } from '../../../shared/application/store';
import {
  useAtomMount,
  useAtomRef,
  useAtomSet,
  useAtomValue,
} from '@effect/atom-react';
import { AccessibilityInfo } from 'react-native';
import { Atom } from 'effect/reactivity';
import { useIsFocused } from 'expo-router';
import {
  readRemoteConnectionStatus,
  readingConnection,
  remoteWritable,
  remoteWriteGuard,
  revalidateRemoteStatus,
} from '@porcelain/client/access';
import type {
  ReadingConnectionNotice,
  Remote,
} from '@porcelain/client/access/rules';
import { accessPlatform } from '../../../shared/adapters/access-platform';

const focusedRemoteStatus = Atom.family(
  ({ focused, remote }: { focused: boolean; remote: Remote }) =>
    Atom.make(() => {
      if (focused) revalidateRemoteStatus(accessPlatform, remote);
    }),
);

export function useEnvironmentStatus(remote: Remote) {
  const entry = useAtomRef(remoteConnectionState).find(
    (entry) => entry.remote.environmentId === remote.environmentId,
  );
  const atom = readRemoteConnectionStatus(
    accessPlatform,
    remote,
    entry?.connection,
  );
  const result = useAtomValue(atom);
  const focused = useIsFocused();
  useAtomMount(focusedRemoteStatus({ focused, remote }));
  return {
    atom,
    status: result,
  };
}

const readingAnnouncement = Atom.family(
  (notice: Atom.Atom<ReadingConnectionNotice | undefined>) =>
    Atom.make((get) => {
      get.subscribe(
        notice.pipe(Atom.map((value) => value?.title)),
        (title) => {
          if (title) AccessibilityInfo.announceForAccessibility(title);
        },
        { immediate: true },
      );
    }),
);

export function useReadingConnectionNotice(remote: Remote) {
  const { atom } = useEnvironmentStatus(remote);
  const notice = readingConnection(atom);
  useAtomMount(readingAnnouncement(notice));
  return useAtomValue(notice);
}

const writableWithoutRemote = Atom.make(true);

export function useWritesBlocked(environmentId: string) {
  const focused = useIsFocused();
  const entry = useAtomRef(remoteConnectionState).find(
    (candidate) => candidate.remote.environmentId === environmentId,
  );
  return !useAtomValue(
    entry && focused
      ? remoteWritable(
          readRemoteConnectionStatus(
            accessPlatform,
            entry.remote,
            entry.connection,
          ),
        )
      : writableWithoutRemote,
  );
}

const writeWithoutRemote = Atom.writable(
  () => undefined,
  (_ctx, write: () => void) => write(),
);

export function useWriteAllowed(environmentId: string) {
  const entry = useAtomRef(remoteConnectionState).find(
    (candidate) => candidate.remote.environmentId === environmentId,
  );
  const guard = useAtomSet(
    entry
      ? remoteWriteGuard(
          readRemoteConnectionStatus(
            accessPlatform,
            entry.remote,
            entry.connection,
          ),
        )
      : writeWithoutRemote,
  );
  return () => {
    let allowed = false;
    guard(() => {
      allowed = true;
    });
    return allowed;
  };
}
