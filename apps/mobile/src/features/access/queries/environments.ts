import { remoteConnectionState } from '../../../shared/application/store';
import { useAtomValue, useAtomMount, useAtomRef } from '@effect/atom-react';
import { AccessibilityInfo } from 'react-native';
import { Atom } from 'effect/reactivity';
import { useIsFocused } from 'expo-router';
import {
  readRemoteConnectionStatus,
  remoteWorkspaceNotice,
  revalidateRemoteStatus,
} from '@porcelain/client/access';
import {
  readingConnectionNotice,
  type ReadingConnectionNotice,
  type Remote,
  type RemoteStatus,
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

const readingNotice = Atom.family((status: Atom.Atom<RemoteStatus>) =>
  Atom.readable((get) => {
    const notice = readingConnectionNotice(get(status));
    return notice && (!notice.interrupted || get(remoteWorkspaceNotice(status)))
      ? notice
      : undefined;
  }),
);

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
  const notice = readingNotice(atom);
  useAtomMount(readingAnnouncement(notice));
  return useAtomValue(notice);
}
