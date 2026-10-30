import { remoteConnectionState } from '../../../shared/application/store';
import { useAtomValue, useAtomMount, useAtomRef } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { useIsFocused } from 'expo-router';
import {
  readRemoteConnectionStatus,
  revalidateRemoteStatus,
} from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
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
    status: result,
  };
}
