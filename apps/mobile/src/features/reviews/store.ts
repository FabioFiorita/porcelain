import { useStore } from 'zustand';
import { changesStore } from '@porcelain/client/changes';

export function useDiffRecoveryToken(key: string) {
  return useStore(changesStore, (state) => state.pending[key]);
}
