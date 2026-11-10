import { useAtomSet } from '@effect/atom-react';
import { worktreeListHidden, worktreeSection } from '../../projects/index';
import { fileNavigation } from '../store';

export function useOpenFileBeside(workspace: string) {
  const setNavigation = useAtomSet(fileNavigation(workspace));
  const setSection = useAtomSet(worktreeSection(workspace));
  const hideWorktrees = useAtomSet(worktreeListHidden);
  return (path: string) => {
    setNavigation((current) => ({ ...current, selectedPath: path }));
    setSection('files');
    hideWorktrees(true);
  };
}
