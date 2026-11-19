import { useElement, type ElementTarget } from '@/shared/hooks/use-element';
import type { RemoteConnection } from '@porcelain/client/access';
import {
  type NavigatorEntry,
  firstAvailableWorktree,
  selectedWorktreeInProject,
} from '@porcelain/client/projects/rules';
import {
  detectPlatform,
  formatForDisplay,
  formatHotkey,
  parseHotkey,
  useHotkey,
} from '@tanstack/react-hotkeys';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { type ComponentProps, type ReactNode, useState } from 'react';
import type { Sheet } from '@/components/ui/sheet';
import { StateNotice } from '@/shared/views/state-notice';
import { Sidebar, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { WorkspaceReview } from './workspace-review';
import {
  entryKey,
  firstDocumentTitle,
  workspaceTitle,
} from '@/features/workspace/index';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { navigatorFocusPending } from '@/shared/store';
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
import type { ConnectionContext } from '@/shared/workspace/connection';

type Review = {
  selection: NonNullable<ReturnType<typeof selectedWorktreeInProject>>;
  search: WorkspaceSearch;
  inventory: Inventory;
};

const workspaceMessages = {
  'not-found': 'Page not found',
  'missing-worktree': 'Worktree not found',
  empty: 'Select a worktree on the left',
};

export function ConnectedWorkspace({
  review,
  remote,
  unavailable,
  remoteStatus,
  showRemoteNotice,
  notice,
  background = false,
}: {
  background?: boolean;
  review?: Review;
  remote?: RemoteConnection;
  unavailable?: RemoteStatus;
  remoteStatus?: ConnectionContext['remoteStatus'];
  showRemoteNotice?: boolean | undefined;
  notice?: 'not-found' | 'missing-worktree' | undefined;
}) {
  const trigger = useElement<HTMLButtonElement>();
  const focusPending = useAtomValue(navigatorFocusPending);
  const setFocusPending = useAtomSet(navigatorFocusPending);
  const returnFocusTo = (element: HTMLButtonElement | null) => {
    if (!element || !focusPending || background) return;
    element.focus();
    if (document.activeElement === element) setFocusPending(false);
  };
  const navigationTrigger: ElementTarget<HTMLButtonElement> = {
    element: trigger.element,
    attach: (element) => {
      trigger.attach(element);
      returnFocusTo(element);
    },
  };
  const [restoreNavigatorFocus, setRestoreNavigatorFocus] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const { setOpenMobile, isMobile, open, openMobile } = useSidebar();
  const mobileNavigatorEvents: Pick<
    ComponentProps<typeof Sheet>,
    'onOpenChange' | 'onOpenChangeComplete'
  > = {
    onOpenChange: (next, details) => {
      setRestoreNavigatorFocus(!next && details.reason === 'escape-key');
      setOpenMobile(next);
    },
    onOpenChangeComplete: (next) => {
      if (!next && restoreNavigatorFocus) {
        setRestoreNavigatorFocus(false);
        navigationTrigger.element?.focus();
      }
      if (!next) returnFocusTo(navigationTrigger.element);
    },
  };
  const navigate = useNavigate();
  const router = useRouter();
  const local = useConnectedContext();
  const localInventory = useInventory(local.connection);
  const recovery = selectedWorktreeInProject(
    localInventory,
    firstAvailableWorktree(localInventory)?.id,
  );
  const firstRun = !notice && localInventory.projects.length === 0;
  const message = firstRun
    ? 'Open your first project'
    : workspaceMessages[notice ?? 'empty'];
  const remotes = useRemoteConnections();
  const context = { ...useConnectedContext(remote?.connection), remoteStatus };
  const shownOn = remote?.remote.environmentId ?? null;
  const shown = review && {
    remote: shownOn,
    projectId: review.selection.projectId,
    worktreeId: review.selection.worktree.id,
  };
  const firstTitle = useAtomValue(
    firstDocumentTitle(review?.selection.worktree.id ?? ''),
  );
  const title = review
    ? workspaceTitle({
        firstDocument: firstTitle,
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
    : 'Porcelain';
  useDocumentTitle(background ? undefined : title);
  const openWorktree = (target: WorktreeTarget) =>
    navigate({ ...worktreeLocation(target), replace: review === undefined });
  const openHere = useOpenProjectOnThisComputer(local.connection, openWorktree);
  const leaveForSettings = () => setOpenMobile(false);
  const openSettings = (section = defaultSettingsSection) => {
    leaveForSettings();
    void navigate({ to: '/settings/$section', params: { section } });
  };
  const navigator = {
    remotes: desktopShell ? remotes : undefined,
    selected: shown,
    showRemoteNotice,
    onOpenPullRequest: (entry: NavigatorEntry) => {
      if (entry.pullRequest.state !== 'available' || !entry.pullRequest.number)
        return;
      const key = entryKey({
        kind: 'pull-request',
        projectId: entry.projectId,
        number: entry.pullRequest.number,
        environmentId: entry.environmentId,
      });
      setOpenMobile(false);
      const target =
        shown ??
        (entry.worktreeId
          ? {
              remote:
                entry.environmentId === local.connection.environmentId
                  ? null
                  : entry.environmentId,
              projectId: entry.projectId,
              worktreeId: entry.worktreeId,
            }
          : undefined);
      if (!target) return;
      void navigate({
        ...worktreeLocation(target),
        search: { ...(review?.search ?? {}), entry: key },
      });
    },
    onOpenProject: (entry: RemoteConnection | null) =>
      entry
        ? openProjectDialog.openWithPayload({
            remote: entry.remote.environmentId,
          })
        : openHere(),
    onOpenSettings: () => openSettings(),
    onOpenRemotes: (environmentId: string) => {
      leaveForSettings();
      void navigate({
        to: '/settings/$section/$environmentId',
        params: { section: 'computers', environmentId },
      });
    },
    onOpenShortcuts: () => setShortcuts(true),
  };
  const onSearch: SetWorkspaceSearch = (update, options) => {
    if (!shown) return;
    const destination = worktreeLocation(shown);
    if (
      router.buildLocation({}).pathname !==
      router.buildLocation(destination).pathname
    )
      return;
    void navigate({
      ...destination,
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
        <Sidebar variant="floating" {...mobileNavigatorEvents}>
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
          <WorkspaceReview
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
                message={message}
                action={
                  <EmptyWorkspaceAction
                    firstRun={firstRun}
                    notice={notice}
                    recovery={recovery}
                    onOpenProject={() => {
                      setOpenMobile(false);
                      openHere();
                    }}
                  />
                }
              />
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
  navigationTrigger: ElementTarget<HTMLButtonElement>;
  isMobile: boolean;
  open: boolean;
  openMobile: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative grid h-full min-h-0 place-items-center rounded-paper border bg-card p-8">
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

function EmptyWorkspaceAction({
  firstRun,
  notice,
  recovery,
  onOpenProject,
}: {
  firstRun: boolean;
  notice: keyof typeof workspaceMessages | undefined;
  recovery: ReturnType<typeof selectedWorktreeInProject>;
  onOpenProject: () => void;
}) {
  if (firstRun)
    return (
      <Button variant="outline" size="sm" onClick={onOpenProject}>
        Open project
      </Button>
    );
  if (notice === 'missing-worktree' && recovery)
    return (
      <Link
        className={cn(buttonVariants({ size: 'sm' }))}
        to="/$projectId/$worktreeId"
        params={{
          projectId: recovery.projectId,
          worktreeId: recovery.worktree.id,
        }}
      >
        Open available worktree
      </Link>
    );
  if (notice)
    return (
      <Link
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        to="/"
        search={{}}
      >
        Back to workspace
      </Link>
    );
  return null;
}
