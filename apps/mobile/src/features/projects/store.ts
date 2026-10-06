import { useAtomRef } from '@effect/atom-react';
import {
  sameRemoteConnection,
  type Remote,
} from '@porcelain/client/access/rules';
import {
  remoteConnectionState,
  selectionState,
} from '../../shared/application/store';

export function useProjectSelection() {
  return useAtomRef(selectionState);
}

export function useProjectConnection(remote: Remote | undefined) {
  return useAtomRef(remoteConnectionState).find(
    (entry) => remote && sameRemoteConnection(entry.remote, remote),
  )?.connection;
}
