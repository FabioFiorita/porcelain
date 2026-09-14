import { useNavigate, useSearch } from '@tanstack/react-router';
import { LogOutIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  firstAvailableWorktree,
  selectedWorktreeInProject,
} from '../../domain/inventory';
import { discardRejection } from '../../lib/submit-form';
import { connectionErrorMessage, useConnection } from '../../query/connection';
import { useInventory, useRefreshInventory } from '../../query/inventory';
import { ReviewWorkspace } from '../review/review-workspace';
import { OpenProjectDialog } from './open-project-dialog';
import { ProjectNavigator } from './project-navigator';
import { WorkspaceControls } from './workspace-controls';

export function ConnectedWorkspace() {
  return (
    <TooltipProvider delay={400}>
      <SidebarProvider
        className="workspace-shell"
        style={{ '--sidebar-width': '16.5rem' } as React.CSSProperties}
      >
        <WorkspaceNavigation />
      </SidebarProvider>
    </TooltipProvider>
  );
}

function WorkspaceNavigation() {
  const navigationTrigger = useRef<HTMLButtonElement>(null);
  const [openProject, setOpenProject] = useState(false);
  const { setOpenMobile, isMobile, open } = useSidebar();
  const { disconnect, disconnectError, disconnectPending } = useConnection();
  const { worktree: selected } = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const inventory = useInventory();
  const refresh = useRefreshInventory();
  const selection = selectedWorktreeInProject(inventory, selected);
  const fallback = firstAvailableWorktree(inventory);
  const error = disconnectError ?? refresh.error;
  useEffect(() => {
    if (selection || !fallback) return;
    void navigate({ search: { worktree: fallback.id }, replace: true });
  }, [fallback, navigate, selection]);
  return (
    <>
      <Sidebar
        variant="floating"
        mobileFinalFocus={navigationTrigger}
        className="workspace-sidebar"
        inert={!isMobile && !open}
      >
        <SidebarHeader className="border-b px-3 py-2">
          <div className="flex h-8 items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-xs font-semibold text-background">
              P
            </span>
            <h1 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
              Porcelain
            </h1>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open project"
              title="Open project"
              onClick={() => setOpenProject(true)}
            >
              <PlusIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Refresh"
              title="Refresh projects"
              disabled={refresh.isPending}
              onClick={() => discardRejection(refresh.submit())}
            >
              <RefreshCwIcon
                className={
                  refresh.isPending
                    ? 'animate-spin motion-reduce:animate-none'
                    : ''
                }
              />
            </Button>
            <SidebarTrigger
              aria-label="Close projects sidebar"
              className="md:hidden"
            />
          </div>
        </SidebarHeader>
        {error && (
          <Alert variant="destructive" className="mx-2 mb-2 py-2 text-xs">
            <AlertDescription>
              {connectionErrorMessage(error)}
              {refresh.error && ' Displayed inventory may be out of date.'}
            </AlertDescription>
          </Alert>
        )}
        <SidebarContent className="overflow-hidden px-0">
          <ScrollArea className="h-full min-h-0 flex-1">
            <ProjectNavigator
              projects={inventory.projects}
              selected={selected ?? null}
              onSelect={(id) => {
                void navigate({ search: { worktree: id } });
                setOpenMobile(false);
              }}
            />
          </ScrollArea>
        </SidebarContent>
        <SidebarFooter className="border-t p-2">
          <div className="flex items-center gap-1">
            <span
              role="status"
              className="min-w-0 flex-1 truncate px-2 text-xs text-muted-foreground"
            >
              {error ? 'Connection needs attention' : 'Connected'}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Disconnect"
              title="Disconnect environment"
              disabled={disconnectPending}
              onClick={() => {
                void disconnect();
                void navigate({ search: {} });
              }}
            >
              <LogOutIcon />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="h-svh min-w-0 overflow-hidden bg-transparent p-2 md:pl-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selection ? (
            <ReviewWorkspace
              key={selection.worktree.id}
              navigationTrigger={navigationTrigger}
              worktree={selection.worktree}
              projectId={selection.projectId}
            />
          ) : (
            <>
              <WorkspaceControls navigationTrigger={navigationTrigger}>
                <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                  Workspace
                </span>
              </WorkspaceControls>
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Select a worktree</EmptyTitle>
                  <EmptyDescription>
                    Choose a worktree to establish your review context.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </>
          )}
        </div>
      </SidebarInset>
      <OpenProjectDialog open={openProject} onOpenChange={setOpenProject} />
    </>
  );
}
