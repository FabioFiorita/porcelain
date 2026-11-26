import { useAtom } from '@effect/atom-react';
import { useDrawerMode } from '../../../components/ui/side-drawer';
import { worktreeDrawerOpen, worktreeSidebarHidden } from '../store';

export function useWorktreeDrawer() {
  const [open, setOpen] = useAtom(worktreeDrawerOpen);
  const [hidden, setHidden] = useAtom(worktreeSidebarHidden);
  const mode = useDrawerMode();
  return {
    mode,
    open,
    hidden,
    setOpen,
    show: () => (mode === 'pinned' ? setHidden(false) : setOpen(true)),
    toggle: () => (mode === 'pinned' ? setHidden(!hidden) : setOpen(!open)),
    close: () => setOpen(false),
  };
}
