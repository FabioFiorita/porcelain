import { useAtomSet } from '@effect/atom-react';
import { fileNavigation } from '../store';

export function useOpenFileBeside(workspace: string) {
  const setNavigation = useAtomSet(fileNavigation(workspace));
  return (path: string) =>
    setNavigation((current) => ({ ...current, selectedPath: path }));
}
