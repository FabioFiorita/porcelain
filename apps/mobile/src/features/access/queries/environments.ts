import { useAtomValue } from '@effect/atom-react';
import { useEffect } from 'react';
import { useIsFocused } from 'expo-router';
import {
  readRemoteStatus,
  remoteStatusResult,
  revalidateRemoteStatus,
} from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import { accessPlatform } from '../../../shared/adapters/access-platform';

export function useEnvironmentStatus(remote: Remote) {
  const atom = readRemoteStatus(accessPlatform, remote);
  const result = useAtomValue(atom);
  const focused = useIsFocused();
  useEffect(() => {
    if (focused) revalidateRemoteStatus(accessPlatform, remote);
  }, [focused, remote]);
  return {
    status: remoteStatusResult(remote, result),
  };
}
