import { detectPlatform, useHotkey } from '@tanstack/react-hotkeys';
import { useNavigate } from '@tanstack/react-router';
import { type RefObject, useRef, useState } from 'react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Sidebar, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { useAccessStore } from '@/features/access/index';
import {
  OpenProjectDialog,
  openProjectDialog,
  ProjectNavigator,
  ProjectWorkspace,
  selectedWorktreeInProject,
  useInventory,
} from '@/features/projects/index';
import { ReviewWorkspace } from '@/features/reviews/index';
import { useConnectedContext } from '@/app/workspace-provider';
import { SettingsDialog } from '@/app/settings-dialog';
import { ShortcutsDialog } from '@/app/shortcuts-dialog';
import type {
  SetWorkspaceSearch,
  WorkspaceSearch,
} from '@/shared/workspace/search';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';

type Review = {
  selection: NonNullable<ReturnType<typeof selectedWorktreeInProject>>;
  search: WorkspaceSearch;
  onSearch: SetWorkspaceSearch;
};

export function ConnectedWorkspace({ review }: { review?: Review }) {
  const navigationTrigger = useRef<HTMLButtonElement>(null);
  const [settings, setSettings] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const { setOpenMobile, isMobile, open, openMobile, toggleSidebar } =
    useSidebar();
  const navigate = useNavigate();
  const connection = useAccessStore((state) => state.connection);
  const inventory = useInventory(connection);
  const selectedWorktreeId = review?.selection.worktree.id;
  const openWorktree = (projectId: string, worktreeId: string) =>
    navigate({
      to: '/$projectId/$worktreeId',
      params: { projectId, worktreeId },
      replace: review === undefined,
    });
  const selectWorktree = (id: string) => {
    const target = selectedWorktreeInProject(inventory, id);
    if (target) void openWorktree(target.projectId, target.worktree.id);
  };
  const navigator = {
    inventory,
    selectedWorktreeId,
    onOpenProject: () => openProjectDialog.open(null),
    onOpenSettings: () => setSettings(true),
    onOpenShortcuts: () => setShortcuts(true),
  };

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
        <Sidebar variant="floating" mobileFinalFocus={navigationTrigger}>
          <ProjectNavigator
            {...navigator}
            onSelect={(id) => {
              selectWorktree(id);
              setOpenMobile(false);
            }}
          />
        </Sidebar>
      )}
      <ProjectWorkspace
        navigator={{ ...navigator, onSelect: selectWorktree }}
        isMobile={isMobile}
        open={open}
      >
        <WorkspaceDocument
          navigationTrigger={navigationTrigger}
          review={review}
          isMobile={isMobile}
          open={open}
          openMobile={openMobile}
        />
      </ProjectWorkspace>

      <OpenProjectDialog onOpened={openWorktree} />
      <SettingsDialog open={settings} onOpenChange={setSettings} />
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
    </>
  );
}

function WorkspaceDocument({
  navigationTrigger,
  review,
  isMobile,
  open,
  openMobile,
}: {
  navigationTrigger: RefObject<HTMLButtonElement | null>;
  review: Review | undefined;
  isMobile: boolean;
  open: boolean;
  openMobile: boolean;
}) {
  const context = useConnectedContext();
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {review ? (
        <ReviewWorkspace
          key={review.selection.worktree.id}
          navigationTrigger={navigationTrigger}
          worktree={review.selection.worktree}
          projectId={review.selection.projectId}
          search={review.search}
          onSearch={review.onSearch}
          context={context}
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
