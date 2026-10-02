import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { createAccessStore, type AccessStore } from '@porcelain/client/access';
import { accessPlatform } from './adapters/client';
import { environmentStorage } from './adapters/environment-storage';

export const accessStore: AccessStore = createAccessStore(environmentStorage);

export function pairingPlatform() {
  return accessPlatform;
}

function hasPairedEnvironment(environmentId: string) {
  return (
    accessStore.getState().status === 'ready' &&
    accessStore
      .getState()
      .remotes.some((remote) => remote.environmentId === environmentId)
  );
}

function pairedEnvironmentIds() {
  const state = accessStore.getState();
  return state.status === 'ready'
    ? state.remotes.map((remote) => remote.environmentId)
    : undefined;
}

export const environmentSelectionAccess = {
  hasEnvironment: hasPairedEnvironment,
  readEnvironmentIds: pairedEnvironmentIds,
};

export function useEnvironments() {
  return useStore(accessStore, (state) => state.remotes);
}

export function useEnvironmentStorageStatus() {
  return useStore(
    accessStore,
    useShallow((state) => ({
      status: state.status,
      error: state.error,
    })),
  );
}
