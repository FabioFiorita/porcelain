import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { SidebarProvider } from '@/components/ui/sidebar';
import { ProjectNavigator } from './project-navigator';
import { cn } from '@/shared/lib/utils';
import { useElement } from '@/shared/hooks/use-element';

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
    <SidebarProvider open={open} onOpenChange={onOpenChange}>
      {children}
    </SidebarProvider>
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
  const [navigatorWidth, setNavigatorWidth] = useState(248);
  const [navigatorPanel, setNavigatorPanel] =
    useState<PanelImperativeHandle | null>(null);
  const group = useElement<HTMLDivElement>();
  return (
    <div
      className={cn(
        'h-svh min-w-0 flex-1 bg-frame p-2 text-ui text-foreground',
        (isMobile || !open) && 'desktop-workspace-without-navigator',
      )}
    >
      <ResizablePanelGroup
        orientation="horizontal"
        elementRef={group.attach}
        onLayoutChanged={(layout, { isUserInteraction }) => {
          if (!navigatorPanel || !group.element || isMobile || !open) return;
          if (isUserInteraction) {
            const available = Array.from(group.element.children).reduce(
              (width, child) =>
                child instanceof HTMLElement && child.hasAttribute('data-panel')
                  ? width + child.offsetWidth
                  : width,
              0,
            );
            setNavigatorWidth((available * (layout.navigator ?? 0)) / 100);
          } else {
            navigatorPanel.resize(navigatorWidth);
          }
        }}
      >
        {!isMobile && open && (
          <>
            <ResizablePanel
              id="navigator"
              panelRef={setNavigatorPanel}
              groupResizeBehavior="preserve-pixel-size"
              defaultSize={navigatorWidth}
              minSize={220}
              maxSize={420}
            >
              <ProjectNavigator {...navigator} />
            </ResizablePanel>
            <ResizableHandle
              aria-label="Worktree navigator and document panes"
              className="w-2 bg-transparent after:w-2"
            />
          </>
        )}
        <ResizablePanel id="document" minSize={isMobile ? 0 : 420}>
          <div className="flex h-full min-h-0 min-w-0 flex-col">{children}</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
