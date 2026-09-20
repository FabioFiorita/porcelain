import { detectPlatform, useHotkey } from '@tanstack/react-hotkeys';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  firstAvailableWorktree,
  selectedWorktreeInProject,
} from '../../domain/inventory';
import { useInventory } from '../../query/inventory';
import { ReviewWorkspace } from '../review/review-workspace';
import { OpenProjectDialog } from './open-project-dialog';
import { ProjectNavigator } from './project-navigator';
import { SettingsDialog } from './settings-dialog';
import { SHORTCUTS } from './shortcuts';
import { ShortcutsDialog } from './shortcuts-dialog';

const NAVIGATOR_HANDLE = 'w-2! bg-transparent! after:w-2! focus-visible:ring-0';

export function ConnectedWorkspace() {
  const [navigatorOpen, setNavigatorOpen] = useState(true);

  return (
    <TooltipProvider delay={400}>
      <SidebarProvider
        open={navigatorOpen}
        onOpenChange={setNavigatorOpen}
        className="workspace-shell"
      >
        <WorkspaceNavigation />
      </SidebarProvider>
    </TooltipProvider>
  );
}

function WorkspaceNavigation() {
  const navigationTrigger = useRef<HTMLButtonElement>(null);
  const [openProject, setOpenProject] = useState(false);
  const [settings, setSettings] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const { setOpenMobile, isMobile, open, openMobile, toggleSidebar } =
    useSidebar();
  const { worktree: selected } = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const inventory = useInventory();
  const selection = selectedWorktreeInProject(inventory, selected);
  const fallback = firstWaitingWorktree(inventory);

  useEffect(() => {
    if (selection || (!fallback && !selected)) return;
    void navigate({
      search: fallback ? { worktree: fallback.id } : {},
      replace: true,
    });
  }, [fallback, navigate, selected, selection]);

  useHotkey(
    SHORTCUTS.toggleNavigator,
    () => {
      if (!isMobile && open)
        requestAnimationFrame(() => navigationTrigger.current?.focus());
      toggleSidebar();
    },
    { ignoreInputs: true },
  );
  useHotkey(SHORTCUTS.openSettings, () => setSettings(true), {
    ignoreInputs: true,
  });
  useHotkey(SHORTCUTS.openShortcuts, () => setShortcuts(true), {
    ignoreInputs: true,
  });

  return (
    <>
      {isMobile && (
        <MobileNavigation
          navigationTrigger={navigationTrigger}
          selectedWorktreeId={selected}
          inventory={inventory}
          setOpenMobile={setOpenMobile}
          onSelectWorktree={(id) => {
            void navigate({ search: { worktree: id } });
          }}
          openProject={() => setOpenProject(true)}
          openSettings={() => setSettings(true)}
          openShortcuts={() => setShortcuts(true)}
        />
      )}
      <WorkspaceShell
        navigationTrigger={navigationTrigger}
        selection={selection}
        selectedWorktreeId={selected}
        inventory={inventory}
        isMobile={isMobile}
        open={open}
        openMobile={openMobile}
        onSelectWorktree={(id) => {
          void navigate({ search: { worktree: id } });
        }}
        openProject={() => setOpenProject(true)}
        openSettings={() => setSettings(true)}
        openShortcuts={() => setShortcuts(true)}
      />

      <OpenProjectDialog open={openProject} onOpenChange={setOpenProject} />
      <SettingsDialog open={settings} onOpenChange={setSettings} />
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
    </>
  );
}

type Selection = ReturnType<typeof selectedWorktreeInProject>;
type NavigationProps = {
  navigationTrigger: React.RefObject<HTMLButtonElement | null>;
  selection: Selection;
  selectedWorktreeId: string | undefined;
  inventory: ReturnType<typeof useInventory>;
  isMobile: boolean;
  open: boolean;
  openMobile: boolean;
  onSelectWorktree: (id: string) => void;
  openProject: () => void;
  openSettings: () => void;
  openShortcuts: () => void;
};

function MobileNavigation({
  navigationTrigger,
  selectedWorktreeId,
  inventory,
  setOpenMobile,
  onSelectWorktree,
  openProject,
  openSettings,
  openShortcuts,
}: Pick<
  NavigationProps,
  | 'navigationTrigger'
  | 'selectedWorktreeId'
  | 'inventory'
  | 'onSelectWorktree'
  | 'openProject'
  | 'openSettings'
  | 'openShortcuts'
> & { setOpenMobile: (open: boolean) => void }) {
  return (
    <Sidebar
      variant="floating"
      mobileFinalFocus={navigationTrigger}
      className="workspace-sidebar"
    >
      <ProjectNavigator
        inventory={inventory}
        selectedWorktreeId={selectedWorktreeId}
        onOpenProject={openProject}
        onOpenSettings={openSettings}
        onOpenShortcuts={openShortcuts}
        onSelect={(id) => {
          onSelectWorktree(id);
          setOpenMobile(false);
        }}
      />
    </Sidebar>
  );
}

function WorkspaceShell({
  navigationTrigger,
  selection,
  selectedWorktreeId,
  inventory,
  isMobile,
  open,
  openMobile,
  onSelectWorktree,
  openProject,
  openSettings,
  openShortcuts,
}: NavigationProps) {
  return (
    <div className="h-svh min-w-0 flex-1 bg-muted p-2 text-[13px] text-foreground">
      <ResizablePanelGroup orientation="horizontal">
        {!isMobile && open && (
          <>
            <ResizablePanel
              id="navigator"
              defaultSize={264}
              minSize={220}
              maxSize={420}
            >
              <ProjectNavigator
                inventory={inventory}
                selectedWorktreeId={selectedWorktreeId}
                onOpenProject={openProject}
                onOpenSettings={openSettings}
                onOpenShortcuts={openShortcuts}
                onSelect={(id) => {
                  onSelectWorktree(id);
                }}
              />
            </ResizablePanel>
            <ResizableHandle className={NAVIGATOR_HANDLE} />
          </>
        )}
        <ResizablePanel id="document" minSize={isMobile ? 0 : 420}>
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <WorkspaceDocument
              navigationTrigger={navigationTrigger}
              selection={selection}
              isMobile={isMobile}
              open={open}
              openMobile={openMobile}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function WorkspaceDocument({
  navigationTrigger,
  selection,
  isMobile,
  open,
  openMobile,
}: Pick<
  NavigationProps,
  'navigationTrigger' | 'selection' | 'isMobile' | 'open' | 'openMobile'
>) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {selection ? (
        <ReviewWorkspace
          key={selection.worktree.id}
          navigationTrigger={navigationTrigger}
          worktree={selection.worktree}
          projectId={selection.projectId}
        />
      ) : (
        <div className="relative grid h-full min-h-0 place-items-center rounded-xl border bg-card p-8">
          <SidebarTrigger
            ref={navigationTrigger}
            className="absolute top-3 left-3"
            aria-label="Toggle Sidebar"
            aria-expanded={isMobile ? openMobile : open}
            aria-keyshortcuts={
              detectPlatform() === 'mac' ? 'Meta+B' : 'Control+B'
            }
            title={`Toggle projects (${SHORTCUTS.toggleNavigator})`}
          />
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Select a worktree</EmptyTitle>
              <EmptyDescription>
                Choose a worktree to establish your review context.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </div>
  );
}

/**
 * Where to land when nothing is selected: the first worktree with something
 * waiting. The dot already says which those are, so this costs no request —
 * and a worktree whose files are all marked is not waiting for anyone.
 */
function firstWaitingWorktree(inventory: ReturnType<typeof useInventory>) {
  const worktrees = inventory.projects.flatMap((project) => project.worktrees);
  return (
    worktrees.find(
      (worktree) =>
        worktree.available &&
        (worktree.status === 'replied' || worktree.status === 'pending'),
    ) ?? firstAvailableWorktree(inventory)
  );
}
