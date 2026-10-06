import { Atom } from 'effect/reactivity';
import { useAtomRef, useAtomValue } from '@effect/atom-react';
import type { LiveConnection } from '@porcelain/client/live';
import type { AccessPlatformValue } from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import { selectionState } from '../../shared/application/store';
import { createProjectConnection } from './adapters/connection';

export function useProjectSelection() {
  return useAtomRef(selectionState);
}

const disconnected = Atom.make<LiveConnection | undefined>(undefined);
const environmentConnection = Atom.family(
  (input: {
    environmentId: string;
    address: string;
    credential: string;
    deviceId: string | undefined;
    send: AccessPlatformValue['send'];
  }) =>
    Atom.make((get) => {
      const lifetime = createProjectConnection(input);
      get.addFinalizer(lifetime.close);
      return lifetime.connection;
    }).pipe(Atom.setIdleTTL(0)),
);

export function useProjectConnection(
  remote: Remote | undefined,
  send: AccessPlatformValue['send'],
) {
  return useAtomValue(
    remote
      ? environmentConnection({
          environmentId: remote.environmentId,
          address: remote.address,
          credential: remote.credential,
          deviceId: remote.deviceId,
          send,
        })
      : disconnected,
  );
}
