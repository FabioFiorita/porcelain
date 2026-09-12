import { useNavigate, useSearch } from '@tanstack/react-router';
import { BoxIcon, LogOutIcon, RefreshCwIcon, ServerIcon } from 'lucide-react';
import { useRef } from 'react';
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
import { selectedWorktreeInProject } from '../../domain/inventory';
import { discardRejection } from '../../lib/submit-form';
import { connectionErrorMessage, useConnection } from '../../query/connection';
import { useInventory, useRefreshInventory } from '../../query/inventory';
import { ReviewWorkspace } from '../review/review-workspace';
import { ProjectNavigator } from './project-navigator';
import { WorkspaceControls } from './workspace-controls';

export function ConnectedWorkspace() {
  return (
    <TooltipProvider delay={400}>
      <SidebarProvider
        className="workspace-shell"
        style={{ '--sidebar-width': '17.5rem' } as React.CSSProperties}
      >
        <WorkspaceNavigation />
      </SidebarProvider>
    </TooltipProvider>
  );
}

function WorkspaceNavigation() {
  const navigationTrigger = useRef<HTMLButtonElement>(null);
  const { setOpenMobile, isMobile, open } = useSidebar();
  const { disconnect, disconnectError, disconnectPending } = useConnection();
  const { worktree: selected } = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const inventory = useInventory();
  const refresh = useRefreshInventory();
  const selection = selectedWorktreeInProject(inventory, selected);
  const error = disconnectError ?? refresh.error;
  return (
    <>
      <Sidebar
        variant="floating"
        mobileFinalFocus={navigationTrigger}
        className="workspace-sidebar"
        inert={!isMobile && !open}
      >
        <SidebarHeader className="gap-3 px-3 pb-3 pt-3">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-xl bg-foreground text-background">
              <BoxIcon className="size-4" />
            </span>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">
                Porcelain
              </h1>
              <p className="text-xs text-muted-foreground">
                A place for review
              </p>
            </div>
            <SidebarTrigger
              aria-label="Close projects sidebar"
              className="ml-auto md:hidden"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 px-2 py-2">
            <ServerIcon className="size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-medium">Environment</h2>
              <p role="status" className="text-xs text-muted-foreground">
                {error ? 'Needs attention' : 'Connected'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Refresh"
              title="Refresh inventory"
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
              <span className="sr-only">
                {refresh.isPending ? 'Refreshing…' : 'Refresh'}
              </span>
            </Button>
          </div>
        </SidebarHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {connectionErrorMessage(error)}
              {refresh.error && ' Displayed inventory may be out of date.'}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between px-4 pb-1 text-xs font-medium text-muted-foreground">
          <span>Projects</span>
          <span>{inventory.projects.length}</span>
        </div>
        <SidebarContent className="overflow-hidden">
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
        <SidebarFooter className="p-2">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-muted-foreground">
              Your review workspace
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
    </>
  );
}
