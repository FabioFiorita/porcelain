import type { ComponentProps, ReactNode } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ProjectNavigator } from './project-navigator';
import { cn } from '@/shared/lib/utils';

export function ProjectWorkspaceProvider({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <TooltipProvider delay={400}>
      <SidebarProvider open={open} onOpenChange={onOpenChange}>
        {children}
      </SidebarProvider>
    </TooltipProvider>
  );
}

export function ProjectWorkspace({
  navigator,
  isMobile,
  open,
  children,
}: {
  navigator: ComponentProps<typeof ProjectNavigator>;
  isMobile: boolean;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'h-svh min-w-0 flex-1 bg-muted p-2 text-[13px] text-foreground',
        (isMobile || !open) && 'desktop-workspace-without-navigator',
      )}
    >
      <ResizablePanelGroup orientation="horizontal">
        {!isMobile && open && (
          <>
            <ResizablePanel
              id="navigator"
              defaultSize={264}
              minSize={220}
              maxSize={420}
            >
              <div className="h-full pr-1">
                <ProjectNavigator {...navigator} />
              </div>
            </ResizablePanel>
            <ResizableHandle />
          </>
        )}
        <ResizablePanel id="document" minSize={isMobile ? 0 : 420}>
          <div
            className={cn(
              'flex h-full min-h-0 min-w-0 flex-col',
              !isMobile && open && 'pl-1',
            )}
          >
            {children}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
