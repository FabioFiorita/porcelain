import {
  detectPlatform,
  formatForDisplay,
  useHotkey,
} from '@tanstack/react-hotkeys';
import type { ReactNode, RefObject } from 'react';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SHORTCUTS } from './shortcuts';
import { ThemeToggle } from './theme';

export function WorkspaceControls({
  children,
  navigationTrigger,
}: {
  children: ReactNode;
  navigationTrigger: RefObject<HTMLButtonElement | null>;
}) {
  const { isMobile, openMobile, open, toggleSidebar } = useSidebar();
  useHotkey(
    SHORTCUTS.toggleNavigator,
    () => {
      if (!isMobile && open) navigationTrigger.current?.focus();
      toggleSidebar();
    },
    { ignoreInputs: true },
  );
  return (
    <div className="workspace-glass flex h-12 min-w-0 shrink-0 items-center gap-1 rounded-lg px-1.5">
      <Tooltip>
        <TooltipTrigger
          render={<SidebarTrigger ref={navigationTrigger} />}
          aria-label="Toggle Sidebar"
          aria-expanded={isMobile ? openMobile : open}
          aria-keyshortcuts={
            detectPlatform() === 'mac' ? 'Meta+B' : 'Control+B'
          }
        />
        <TooltipContent>
          Toggle projects{' '}
          <span>{formatForDisplay(SHORTCUTS.toggleNavigator)}</span>
        </TooltipContent>
      </Tooltip>
      {children}
      <ThemeToggle />
    </div>
  );
}
