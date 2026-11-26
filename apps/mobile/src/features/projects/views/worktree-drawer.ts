import { useAtom } from '@effect/atom-react';
import { useDrawerMode } from '../../../components/ui/side-drawer';
import { worktreeDrawerOpen, worktreeSidebarHidden } from '../store';
import { useWorkspace } from './workspace';

export function useWorktreeDrawer() {
  const [chosen, setOpen] = useAtom(worktreeDrawerOpen);
  const [hidden, setHidden] = useAtom(worktreeSidebarHidden);
  const nothingSelected = useWorkspace().state.kind === 'none';
  const open = chosen ?? nothingSelected;
  const mode = useDrawerMode();
  return {
    mode,
    open,
    hidden,
    setOpen: (next: boolean) => setOpen(next),
    show: () => (mode === 'pinned' ? setHidden(false) : setOpen(true)),
    toggle: () => (mode === 'pinned' ? setHidden(!hidden) : setOpen(!open)),
    close: () => setOpen(false),
  };
}
