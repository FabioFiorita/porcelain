import { detectPlatform, useHotkey } from '@tanstack/react-hotkeys';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, type RefObject, useRef, useState } from 'react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Sidebar, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import {
  RemoteUnavailable,
  useConnectedContext,
  useRemoteConnections,
  type RemoteConnection,
  type RemoteStatus,
} from '@/features/access/index';
import {
  openProjectDialog,
  ProjectNavigator,
  ProjectWorkspace,
  useInventory,
  type Inventory,
  type selectedWorktreeInProject,
  type WorktreeTarget,
} from '@/features/projects/index';
import { ReviewWorkspace, workspaceTitle } from '@/features/reviews/index';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import {
  useOpenProjectOnThisComputer,
  worktreeLocation,
} from '@/app/desktop-actions';
import { ShortcutsDialog } from '@/app/shortcuts-dialog';
import type {
  SetWorkspaceSearch,
  WorkspaceSearch,
} from '@/shared/workspace/search';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { desktopShell } from '@/shared/shell';

type Review = {
  selection: NonNullable<ReturnType<typeof selectedWorktreeInProject>>;
  search: WorkspaceSearch;
  inventory: Inventory;
};

export function ConnectedWorkspace({
  review,
  remote,
  unavailable,
}: {
  review?: Review;
  remote?: RemoteConnection;
  unavailable?: RemoteStatus;
}) {
  const navigationTrigger = useRef<HTMLButtonElement>(null);
  const [shortcuts, setShortcuts] = useState(false);
  const { setOpenMobile, isMobile, open, openMobile } = useSidebar();
  const navigate = useNavigate();
  const local = useConnectedContext();
  const localInventory = useInventory(local.connection);
  const remotes = useRemoteConnections();
  const context = useConnectedContext(remote?.connection);
  const shownOn = remote?.remote.environmentId ?? null;
  const shown = review && {
    remote: shownOn,
    projectId: review.selection.projectId,
    worktreeId: review.selection.worktree.id,
  };
  useDocumentTitle(
    review
      ? workspaceTitle({
          entry: review.search.entry,
          surface: review.search.surface,
          project: review.inventory.projects.find(
            (project) => project.id === review.selection.projectId,
          )?.name,
          environment:
            remote || review.inventory.environment.custom
              ? review.inventory.environment.name
              : undefined,
        })
      : 'Porcelain',
  );
  const openWorktree = (target: WorktreeTarget) =>
    navigate({ ...worktreeLocation(target), replace: review === undefined });
  const openHere = useOpenProjectOnThisComputer(local.connection, openWorktree);
  const openSettings = (section = 'appearance') => {
    setOpenMobile(false);
    void navigate({ to: '/settings/$section', params: { section } });
  };
  const navigator = {
    inventory: localInventory,
    connection: local.connection,
    remotes: desktopShell ? remotes : undefined,
    selected: shown,
    onOpenProject: (entry: RemoteConnection | null) =>
      entry
        ? openProjectDialog.openWithPayload({
            remote: entry.remote.environmentId,
          })
        : openHere(),
    onOpenSettings: () => openSettings(),
    onOpenRemotes: () => openSettings('remotes'),
    onOpenShortcuts: () => setShortcuts(true),
  };
  const onSearch: SetWorkspaceSearch = (update, options) => {
    if (!shown) return;
    void navigate({
      ...worktreeLocation(shown),
      search: (previous) => ({ ...previous, ...update }),
      ...options,
    });
  };

  useHotkey(SHORTCUTS.openSettings, () => openSettings(), {
    ignoreInputs: true,
  });
  useHotkey(SHORTCUTS.openShortcuts, () => setShortcuts(true), {
    ignoreInputs: true,
  });

  return (
    <>
      {isMobile && (
        <Sidebar variant="floating">
          <ProjectNavigator
            {...navigator}
            onSelect={(target) => {
              void openWorktree(target);
              setOpenMobile(false);
            }}
          />
        </Sidebar>
      )}
      <ProjectWorkspace
        navigator={{
          ...navigator,
          onSelect: (target) => void openWorktree(target),
        }}
        isMobile={isMobile}
        open={open}
      >
        {review ? (
          <ReviewWorkspace
            key={`${shownOn ?? ''}:${review.selection.worktree.id}`}
            navigationTrigger={navigationTrigger}
            worktree={review.selection.worktree}
            projectId={review.selection.projectId}
            search={review.search}
            onSearch={onSearch}
            context={context}
          />
        ) : (
          <EmptyWorkspace
            navigationTrigger={navigationTrigger}
            isMobile={isMobile}
            open={open}
            openMobile={openMobile}
          >
            {remote && unavailable ? (
              <RemoteUnavailable
                name={remote.remote.name}
                status={unavailable}
                onOpenRemotes={() => openSettings('remotes')}
              />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Select a worktree</EmptyTitle>
                  <EmptyDescription>
                    Choose a worktree to establish your review context.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </EmptyWorkspace>
        )}
      </ProjectWorkspace>

      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
    </>
  );
}

function EmptyWorkspace({
  navigationTrigger,
  isMobile,
  open,
  openMobile,
  children,
}: {
  navigationTrigger: RefObject<HTMLButtonElement | null>;
  isMobile: boolean;
  open: boolean;
  openMobile: boolean;
  children: ReactNode;
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
      {children}
    </div>
  );
}
