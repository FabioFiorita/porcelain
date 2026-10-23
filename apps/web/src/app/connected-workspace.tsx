import { useElement, type ElementTarget } from '@/shared/hooks/use-element';
import type { RemoteConnection } from '@porcelain/client/access';
import {
  firstWaitingWorktree,
  selectedWorktreeInProject,
} from '@porcelain/client/projects/rules';
import {
  detectPlatform,
  formatForDisplay,
  formatHotkey,
  parseHotkey,
  useHotkey,
} from '@tanstack/react-hotkeys';
import { Link, useNavigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { StateNotice } from '@/shared/views/state-notice';
import { GitBranchIcon, CompassIcon, FolderXIcon } from 'lucide-react';
import { Sidebar, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { buttonVariants } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  RemoteUnavailable,
  useConnectedContext,
  useRemoteConnections,
} from '@/features/access/index';
import { type RemoteStatus } from '@porcelain/client/access/rules';
import {
  openProjectDialog,
  ProjectNavigator,
  ProjectWorkspace,
  useInventory,
  type WorktreeTarget,
} from '@/features/projects/index';
import { type Inventory } from '@porcelain/client/projects/rules';
import { ReviewWorkspace, workspaceTitle } from '@/features/reviews/index';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import {
  useOpenProjectOnThisComputer,
  worktreeLocation,
} from '@/app/desktop-actions';
import { defaultSettingsSection } from '@/app/settings-page';
import { ShortcutsDialog } from '@/app/shortcuts-dialog';
import type {
  SetWorkspaceSearch,
  WorkspaceSearch,
} from '@/shared/workspace/search';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { desktopShell } from '@/shared/shell';
import { cn } from '@/shared/lib/utils';

type Review = {
  selection: NonNullable<ReturnType<typeof selectedWorktreeInProject>>;
  search: WorkspaceSearch;
  inventory: Inventory;
};

const workspaceMessages = {
  'not-found': {
    title: 'Page not found',
    description: 'This URL does not open a page in Porcelain.',
    icon: CompassIcon,
  },
  'missing-worktree': {
    title: 'Worktree not found',
    description: 'This URL has an invalid or unavailable worktree ID.',
    icon: FolderXIcon,
  },
  empty: {
    title: 'Select a worktree',
    description: 'Choose one on the left to open its review.',
    icon: GitBranchIcon,
  },
};

export function ConnectedWorkspace({
  review,
  remote,
  unavailable,
  notice,
  children,
}: {
  children?: ReactNode;
  review?: Review;
  remote?: RemoteConnection;
  unavailable?: RemoteStatus;
  notice?: 'not-found' | 'missing-worktree' | undefined;
}) {
  const navigationTrigger = useElement<HTMLButtonElement>();
  const message = workspaceMessages[notice ?? 'empty'];
  const NoticeIcon = message.icon;
  const [shortcuts, setShortcuts] = useState(false);
  const { setOpenMobile, isMobile, open, openMobile } = useSidebar();
  const navigate = useNavigate();
  const local = useConnectedContext();
  const localInventory = useInventory(local.connection);
  const recovery = selectedWorktreeInProject(
    localInventory,
    firstWaitingWorktree(localInventory)?.id,
  );
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
  const openSettings = (section = defaultSettingsSection) => {
    setOpenMobile(false);
    void navigate({ to: '/settings/$section', params: { section } });
  };
  const navigator = {
    remotes: desktopShell ? remotes : undefined,
    selected: shown,
    onOpenProject: (entry: RemoteConnection | null) =>
      entry
        ? openProjectDialog.openWithPayload({
            remote: entry.remote.environmentId,
          })
        : openHere(),
    onOpenSettings: () => openSettings(),
    onOpenRemotes: (environmentId: string) => {
      setOpenMobile(false);
      void navigate({
        to: '/settings/$section/$environmentId',
        params: { section: 'computers', environmentId },
      });
    },
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
        {children ??
          (review ? (
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
                  onOpenRemotes={() =>
                    navigator.onOpenRemotes(remote.remote.environmentId)
                  }
                />
              ) : (
                <StateNotice
                  title={message.title}
                  description={message.description}
                  icon={<NoticeIcon />}
                >
                  {!notice && recovery && (
                    <div className="flex w-full min-w-0 flex-col gap-2">
                      <p className="text-sm text-muted-foreground">
                        First that needs you
                      </p>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Link
                              className="flex min-w-0 flex-col rounded-lg border p-3 text-ui hover:bg-accent"
                              to="/$projectId/$worktreeId"
                              params={{
                                projectId: recovery.projectId,
                                worktreeId: recovery.worktree.id,
                              }}
                            >
                              <span className="truncate font-medium">
                                {recovery.worktree.branch ?? 'Detached HEAD'}
                              </span>
                            </Link>
                          }
                        />
                        <TooltipContent className="max-w-sm break-words">
                          {recovery.worktree.branch ?? 'Detached HEAD'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                  {notice === 'missing-worktree' && recovery && (
                    <Link
                      className={cn(buttonVariants())}
                      to="/$projectId/$worktreeId"
                      params={{
                        projectId: recovery.projectId,
                        worktreeId: recovery.worktree.id,
                      }}
                    >
                      Open available worktree
                    </Link>
                  )}
                  {notice && (
                    <Link
                      className={cn(buttonVariants({ variant: 'outline' }))}
                      to="/"
                      search={{}}
                    >
                      Back to workspace
                    </Link>
                  )}
                </StateNotice>
              )}
            </EmptyWorkspace>
          ))}
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
  navigationTrigger: ElementTarget<HTMLButtonElement>;
  isMobile: boolean;
  open: boolean;
  openMobile: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative grid h-full min-h-0 place-items-center rounded-xl border bg-card p-8">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarTrigger
              ref={(element) => navigationTrigger.attach(element)}
              className="absolute top-3 left-3"
              aria-label="Toggle Sidebar"
              aria-expanded={isMobile ? openMobile : open}
              aria-keyshortcuts={formatHotkey(
                parseHotkey(SHORTCUTS.toggleNavigator, detectPlatform()),
              )}
            />
          }
        />
        <TooltipContent side="right">
          Toggle sidebar
          <Kbd>{formatForDisplay(SHORTCUTS.toggleNavigator)}</Kbd>
        </TooltipContent>
      </Tooltip>
      {children}
    </div>
  );
}
