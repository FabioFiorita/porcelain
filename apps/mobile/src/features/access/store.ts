import { Effect } from 'effect';
import { useAtomRef } from '@effect/atom-react';
import { AccessStore, EnvironmentStorage } from '@porcelain/client/access';
import { accessPlatform } from './adapters/client';
import { environmentStorage } from './adapters/environment-storage';

export const accessStore = Effect.runSync(
  AccessStore.pipe(
    Effect.provide(AccessStore.layer),
    Effect.provideService(EnvironmentStorage, environmentStorage),
  ),
);

export function pairingPlatform() {
  return accessPlatform;
}

function hasPairedEnvironment(environmentId: string) {
  return (
    accessStore.state.value.status === 'ready' &&
    accessStore.state.value.remotes.some(
      (remote) => remote.environmentId === environmentId,
    )
  );
}

function pairedEnvironmentIds() {
  const state = accessStore.state.value;
  return state.status === 'ready'
    ? state.remotes.map((remote) => remote.environmentId)
    : undefined;
}

export const environmentSelectionAccess = {
  hasEnvironment: hasPairedEnvironment,
  readEnvironmentIds: pairedEnvironmentIds,
};

export function useEnvironments() {
  return useAtomRef(accessStore.state).remotes;
}

export function useEnvironmentStorageStatus() {
  const { status, error } = useAtomRef(accessStore.state);
  return { status, error };
}
