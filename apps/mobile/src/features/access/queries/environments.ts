import { useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { readRemoteStatus } from '@porcelain/client/access';
import { remoteStatus, type Remote } from '@porcelain/client/access/rules';
import { accessPlatform } from '../../../shared/adapters/access-platform';

export function useEnvironmentStatus(remote: Remote) {
  const result = useAtomValue(readRemoteStatus(accessPlatform, remote));
  return AsyncResult.map(result, (answer) => remoteStatus(remote, answer));
}
