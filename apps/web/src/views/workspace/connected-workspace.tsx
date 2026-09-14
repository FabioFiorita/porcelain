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
  Sidebar,
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
import { useInventory } from '../../query/inventory';
import { ReviewWorkspace } from '../review/review-workspace';
import { OpenProjectDialog } from './open-project-dialog';
import { ProjectNavigator } from './project-navigator';
import { SettingsDialog } from './settings-dialog';
import { SHORTCUTS } from './shortcuts';
import { ShortcutsDialog } from './shortcuts-dialog';

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
    if (selection || !fallback) return;
    void navigate({ search: { worktree: fallback.id }, replace: true });
  }, [fallback, navigate, selection]);

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
      <Sidebar
        variant="floating"
        mobileFinalFocus={navigationTrigger}
        className="workspace-sidebar"
        inert={!isMobile && !open}
      >
        <ProjectNavigator
          inventory={inventory}
          selectedWorktreeId={selected}
          onOpenProject={() => setOpenProject(true)}
          onOpenSettings={() => setSettings(true)}
          onOpenShortcuts={() => setShortcuts(true)}
          showThemeToggle
          onSelect={(id) => {
            void navigate({ search: { worktree: id } });
            setOpenMobile(false);
          }}
        />
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
      </SidebarInset>

      <OpenProjectDialog open={openProject} onOpenChange={setOpenProject} />
      <SettingsDialog open={settings} onOpenChange={setSettings} />
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
    </>
  );
}

function firstWaitingWorktree(inventory: ReturnType<typeof useInventory>) {
  const worktrees = inventory.projects.flatMap((project) => project.worktrees);
  const waiting = worktrees.find((worktree) => {
    const summary = (
      worktree as typeof worktree & {
        reviewSummary?: { pendingFiles?: number };
      }
    ).reviewSummary;
    return worktree.available && (summary?.pendingFiles ?? 0) > 0;
  });
  return waiting ?? firstAvailableWorktree(inventory);
}
