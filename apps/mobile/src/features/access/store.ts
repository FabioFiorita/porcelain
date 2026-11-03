import { useAtomRef } from '@effect/atom-react';
import { accessState } from '../../shared/application/store';

export function useEnvironments() {
  return useAtomRef(accessState).remotes;
}

export function useEnvironmentStorageStatus() {
  const { status, error } = useAtomRef(accessState);
  return { status, error };
}

export function useMissingCredentials() {
  return useAtomRef(accessState).missingCredentials;
}
