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
import { ReviewWorkspace, workspaceTitle } from '@/features/reviews/index';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { useConnectedContext } from '@/app/workspace-provider';
import { ShortcutsDialog } from '@/app/shortcuts-dialog';
import type { WorkspaceSearch } from '@/shared/workspace/search';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';

type Review = {
  selection: NonNullable<ReturnType<typeof selectedWorktreeInProject>>;
  search: WorkspaceSearch;
};

export function ConnectedWorkspace({ review }: { review?: Review }) {
  const navigationTrigger = useRef<HTMLButtonElement>(null);
  const [shortcuts, setShortcuts] = useState(false);
  const { setOpenMobile, isMobile, open, openMobile, toggleSidebar } =
    useSidebar();
  const navigate = useNavigate();
  const connection = useAccessStore((state) => state.connection);
  const inventory = useInventory(connection);
  const context = useConnectedContext();
  const selectedWorktreeId = review?.selection.worktree.id;
  useDocumentTitle(
    review
      ? workspaceTitle({
          entry: review.search.entry,
          surface: review.search.surface,
          project: inventory.projects.find(
            (project) => project.id === review.selection.projectId,
          )?.name,
          environment: inventory.environment.custom
            ? inventory.environment.name
            : undefined,
        })
      : 'Porcelain',
  );
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
  const openSettings = () => {
    setOpenMobile(false);
    void navigate({
      to: '/settings/$section',
      params: { section: 'appearance' },
    });
  };
  const navigator = {
    inventory,
    selectedWorktreeId,
    onOpenProject: () => openProjectDialog.open(null),
    onOpenSettings: openSettings,
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
  useHotkey(SHORTCUTS.openSettings, openSettings, { ignoreInputs: true });
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
        {review ? (
          <ReviewWorkspace
            key={review.selection.worktree.id}
            navigationTrigger={navigationTrigger}
            worktree={review.selection.worktree}
            projectId={review.selection.projectId}
            search={review.search}
            onSearch={(update, options) =>
              void navigate({
                to: '/$projectId/$worktreeId',
                params: {
                  projectId: review.selection.projectId,
                  worktreeId: review.selection.worktree.id,
                },
                search: (previous) => ({ ...previous, ...update }),
                ...options,
              })
            }
            context={context}
          />
        ) : (
          <EmptyWorkspace
            navigationTrigger={navigationTrigger}
            isMobile={isMobile}
            open={open}
            openMobile={openMobile}
          />
        )}
      </ProjectWorkspace>

      <OpenProjectDialog onOpened={openWorktree} />
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
    </>
  );
}

function EmptyWorkspace({
  navigationTrigger,
  isMobile,
  open,
  openMobile,
}: {
  navigationTrigger: RefObject<HTMLButtonElement | null>;
  isMobile: boolean;
  open: boolean;
  openMobile: boolean;
}) {
  return (
    <div className="relative grid h-full min-h-0 place-items-center rounded-xl border bg-card p-8">
      <SidebarTrigger
        ref={navigationTrigger}
        className="absolute top-3 left-3"
        aria-label="Toggle Sidebar"
        aria-expanded={isMobile ? openMobile : open}
        aria-keyshortcuts={detectPlatform() === 'mac' ? 'Meta+B' : 'Control+B'}
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
  );
}
