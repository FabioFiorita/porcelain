import { useAtomSet, useAtomValue } from '@effect/atom-react';
import {
  readDirectories,
  refreshDirectories,
  type DirectorySelection,
} from '@porcelain/client/files';

export function useDirectories(selection: DirectorySelection) {
  const run = useAtomSet(refreshDirectories(selection));
  return {
    results: useAtomValue(readDirectories(selection)),
    refresh: () => run(undefined),
  };
}
