import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { createAccessStore, type AccessStore } from '@porcelain/client/access';
import { accessPlatform } from './adapters/client';
import { environmentStorage } from './adapters/environment-storage';

export const accessStore: AccessStore = createAccessStore(environmentStorage);

export function pairingPlatform() {
  return accessPlatform;
}

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
