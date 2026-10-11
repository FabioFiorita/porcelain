import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AppState } from 'react-native';
import { useEffect } from 'react';
import { useIsFocused } from 'expo-router';
import { readRemoteStatus, remoteStatusResult } from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import { accessPlatform } from '../../../shared/adapters/access-platform';

export function useEnvironmentStatus(remote: Remote) {
  const atom = readRemoteStatus(accessPlatform, remote);
  const result = useAtomValue(atom);
  const read = useAtomRefresh(atom);
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    read();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') read();
    });
    return () => subscription.remove();
  }, [focused, read]);
  return {
    status: remoteStatusResult(remote, result),
    read,
  };
}
