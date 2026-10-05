import { useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import { readRemoteStatus } from '@porcelain/client/access';
import { remoteStatus, type Remote } from '@porcelain/client/access/rules';
import { pairingPlatform } from '../store';

export function useRemoteStatus(remote: Remote) {
  const result = useAtomValue(readRemoteStatus(pairingPlatform, remote));
  return remoteStatus(remote, Option.getOrUndefined(AsyncResult.value(result)));
}
