import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { readRemoteStatus } from '@porcelain/client/access';
import { remoteStatus, type Remote } from '@porcelain/client/access/rules';
import { accessPlatform } from '../../../shared/adapters/access-platform';

export function useEnvironmentStatus(remote: Remote) {
  const atom = readRemoteStatus(accessPlatform, remote);
  const result = useAtomValue(atom);
  const read = useAtomRefresh(atom);
  useFocusEffect(() => {
    read();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') read();
    });
    return () => subscription.remove();
  });
  return {
    status: result.waiting
      ? remoteStatus(remote, undefined)
      : AsyncResult.isFailure(result)
        ? { kind: 'offline' as const }
        : remoteStatus(
            remote,
            Option.getOrUndefined(AsyncResult.value(result)),
          ),
    read,
  };
}
