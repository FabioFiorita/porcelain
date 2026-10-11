import { useAtomValue } from '@effect/atom-react';
import { readRemoteStatus, remoteStatusResult } from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import { pairingPlatform } from '../store';

export function useRemoteStatus(remote: Remote) {
  const result = useAtomValue(readRemoteStatus(pairingPlatform, remote));
  return remoteStatusResult(remote, result);
}
