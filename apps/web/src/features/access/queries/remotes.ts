import { useAtomValue } from '@effect/atom-react';
import { readRemoteConnectionStatus } from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import { pairingPlatform, useRemoteConnection } from '../store';

export function useRemoteStatus(remote: Remote) {
  const entry = useRemoteConnection(remote.environmentId);
  return useAtomValue(
    readRemoteConnectionStatus(pairingPlatform, remote, entry?.connection),
  );
}
