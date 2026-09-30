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
import type { RemoteConnection } from '@/features/access/index';
import {
  OpenProjectDialog,
  openProjectDialog,
  ProjectNavigator,
  ProjectWorkspace,
  useInventory,
  type selectedWorktreeInProject,
  type WorktreeTarget,
} from '@/features/projects/index';
import { ReviewWorkspace, workspaceTitle } from '@/features/reviews/index';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { useConnectedContext } from '@/app/workspace-provider';
import { ShortcutsDialog } from '@/app/shortcuts-dialog';
import type {
  SetWorkspaceSearch,
  WorkspaceSearch,
} from '@/shared/workspace/search';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';

type Review = {
  selection: NonNullable<ReturnType<typeof selectedWorktreeInProject>>;
  search: WorkspaceSearch;
};

export function ConnectedWorkspace({
  review,
  remote,
}: {
  review?: Review;
  remote?: RemoteConnection;
}) {
  const navigationTrigger = useRef<HTMLButtonElement>(null);
  const [shortcuts, setShortcuts] = useState(false);
  const { setOpenMobile, isMobile, open, openMobile } = useSidebar();
  const navigate = useNavigate();
  const local = useConnectedContext();
  const localInventory = useInventory(local.connection);
  const context = useConnectedContext(remote?.connection);
  const inventory = useInventory(context.connection);
  const shownOn = remote?.remote.environmentId ?? null;
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
  const openWorktree = (target: WorktreeTarget) =>
    target.remote === null
      ? navigate({
          to: '/$projectId/$worktreeId',
          params: {
            projectId: target.projectId,
            worktreeId: target.worktreeId,
          },
          replace: review === undefined,
        })
      : navigate({
          to: '/remotes/$environmentId/$projectId/$worktreeId',
          params: {
            environmentId: target.remote,
            projectId: target.projectId,
            worktreeId: target.worktreeId,
          },
          replace: review === undefined,
        });
  const openSettings = (section = 'appearance') => {
    setOpenMobile(false);
    void navigate({ to: '/settings/$section', params: { section } });
  };
  const navigator = {
    inventory: localInventory,
    connection: local.connection,
    selected: review
      ? { remote: shownOn, worktreeId: review.selection.worktree.id }
      : undefined,
    onOpenProject: () => openProjectDialog.open(null),
    onOpenSettings: () => openSettings(),
    onOpenRemotes: () => openSettings('remotes'),
    onOpenShortcuts: () => setShortcuts(true),
  };
  const onSearch: SetWorkspaceSearch = (update, options) => {
    if (!review) return;
    const params = {
      projectId: review.selection.projectId,
      worktreeId: review.selection.worktree.id,
    };
    void (shownOn === null
      ? navigate({
          to: '/$projectId/$worktreeId',
          params,
          search: (previous) => ({ ...previous, ...update }),
          ...options,
        })
      : navigate({
          to: '/remotes/$environmentId/$projectId/$worktreeId',
          params: { environmentId: shownOn, ...params },
          search: (previous) => ({ ...previous, ...update }),
          ...options,
        }));
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
          />
        )}
      </ProjectWorkspace>

      <OpenProjectDialog
        connection={local.connection}
        onOpened={(projectId, worktreeId) =>
          openWorktree({ remote: null, projectId, worktreeId })
        }
      />
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
