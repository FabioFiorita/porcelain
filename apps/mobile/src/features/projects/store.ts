import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { useAtomRef, useAtomValue } from '@effect/atom-react';
import type { LiveConnection } from '@porcelain/client/live';
import type { AccessPlatform } from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import {
  ProjectSelectionStore,
  ProjectSelectionStorage,
} from '@porcelain/client/projects';
import { projectSelectionStorage } from './adapters/selection-storage';
import { createProjectConnection } from './adapters/connection';

export const projectSelectionStore = Effect.runSync(
  ProjectSelectionStore.pipe(
    Effect.provide(ProjectSelectionStore.layer),
    Effect.provideService(ProjectSelectionStorage, projectSelectionStorage),
  ),
);

export function useProjectSelection() {
  return useAtomRef(projectSelectionStore.state);
}

const disconnected = Atom.make<LiveConnection | undefined>(undefined);
const environmentConnection = Atom.family(
  (input: {
    environmentId: string;
    address: string;
    credential: string;
    deviceId: string | undefined;
    send: AccessPlatform['send'];
  }) =>
    Atom.make((get) => {
      const lifetime = createProjectConnection(input);
      get.addFinalizer(lifetime.close);
      return lifetime.connection;
    }).pipe(Atom.setIdleTTL(0)),
);

export function useProjectConnection(
  remote: Remote | undefined,
  send: AccessPlatform['send'],
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
