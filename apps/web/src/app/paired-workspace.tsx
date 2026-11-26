import {
  firstAvailableWorktree,
  selectedWorktreeInProject,
} from '@porcelain/client/projects/rules';
import {
  CatchBoundary,
  type MakeRouteMatchUnion,
  Navigate,
} from '@tanstack/react-router';
import {
  HotkeysProvider,
  useDefaultHotkeysOptions,
} from '@tanstack/react-hotkeys';
import { useAtomValue } from '@effect/atom-react';
import { useState } from 'react';
import { remoteWorkspaceNotice } from '@porcelain/client/access';
import { remoteWorktreeInterrupted } from '@porcelain/client/access/rules';
import {
  remoteConnectionStatus,
  shownRemoteWorkspace,
  useConnectedContext,
  useRemoteConnection,
} from '@/features/access/index';
import { useInventory } from '@/features/projects/index';
import { desktopShell } from '@/shared/shell';
import type { WorkspaceSearch } from '@/shared/workspace/search';
import { ConnectedWorkspace } from './connected-workspace';
import { settingsTarget } from './settings-page';
import { WorkspaceError } from './workspace-error';
import { WorkspacePending } from './workspace-pending';
import { WorktreeRoute } from './worktree-route';

type WorkspaceView =
  | {
      kind: 'home';
      pathname: string;
      search: WorkspaceSearch & { worktree?: string | undefined };
    }
  | {
      kind: 'worktree';
      pathname: string;
      projectId: string;
      worktreeId: string;
      search: WorkspaceSearch;
    }
  | {
      kind: 'remote';
      pathname: string;
      environmentId: string;
      projectId: string;
      worktreeId: string;
      search: WorkspaceSearch;
    }
  | { kind: 'not-found'; pathname: string };

type PairedView = WorkspaceView | { kind: 'settings' };

const home: WorkspaceView = { kind: 'home', pathname: '/', search: {} };

export function pairedView(match: MakeRouteMatchUnion | undefined): PairedView {
  if (!match) return home;
  const { pathname } = match;
  switch (match.routeId) {
    case '/_paired/':
      return { kind: 'home', pathname, search: match.search };
    case '/_paired/$projectId/$worktreeId':
      return {
        kind: 'worktree',
        pathname,
        projectId: match.params.projectId,
        worktreeId: match.params.worktreeId,
        search: match.search,
      };
    case '/_paired/remotes/$environmentId/$projectId/$worktreeId':
      return {
        kind: 'remote',
        pathname,
        environmentId: match.params.environmentId,
        projectId: match.params.projectId,
        worktreeId: match.params.worktreeId,
        search: match.search,
      };
    case '/_paired/settings/$section/':
    case '/_paired/settings/$section/$environmentId': {
      const target = settingsTarget(
        match.params.section,
        'environmentId' in match.params
          ? match.params.environmentId
          : undefined,
      );
      return target ? { kind: 'settings' } : { kind: 'not-found', pathname };
    }
    default:
      return { kind: 'not-found', pathname };
  }
}

export function useWorkspaceBehindSettings(current: PairedView) {
  const key = JSON.stringify(current);
  const [behind, setBehind] = useState(() => ({
    key,
    view: current.kind === 'settings' ? home : current,
  }));
  if (current.kind !== 'settings' && behind.key !== key)
    setBehind({ key, view: current });
  return current.kind === 'settings'
    ? { workspace: behind.view, workspaceKey: behind.key, settingsOpen: true }
    : { workspace: current, workspaceKey: key, settingsOpen: false };
}

export function PairedWorkspace({
  view,
  settled,
  background,
  resetKey,
}: {
  view: WorkspaceView;
  settled: boolean;
  background: boolean;
  resetKey: string;
}) {
  const defaults = useDefaultHotkeysOptions();
  return (
    <HotkeysProvider
      defaultOptions={{
        ...defaults,
        hotkey: { ...defaults.hotkey, enabled: !background },
      }}
    >
      <CatchBoundary
        getResetKey={() => resetKey}
        errorComponent={WorkspaceError}
      >
        <WorkspaceViewContent
          view={view}
          settled={settled}
          background={background}
        />
      </CatchBoundary>
    </HotkeysProvider>
  );
}

function WorkspaceViewContent({
  view,
  settled,
  background,
}: {
  view: WorkspaceView;
  settled: boolean;
  background: boolean;
}) {
  switch (view.kind) {
    case 'home':
      return (
        <WorkspaceHome
          search={view.search}
          settled={settled}
          background={background}
        />
      );
    case 'worktree':
      return (
        <WorktreeRoute
          projectId={view.projectId}
          worktreeId={view.worktreeId}
          search={view.search}
          settled={settled}
          background={background}
        />
      );
    case 'remote':
      return (
        <RemoteWorktree
          key={view.environmentId}
          environmentId={view.environmentId}
          projectId={view.projectId}
          worktreeId={view.worktreeId}
          search={view.search}
          settled={settled}
          background={background}
        />
      );
    case 'not-found':
      return <ConnectedWorkspace notice="not-found" background={background} />;
  }
}

function WorkspaceHome({
  search: { worktree, ...search },
  settled,
  background,
}: {
  search: WorkspaceSearch & { worktree?: string | undefined };
  settled: boolean;
  background: boolean;
}) {
  const { connection } = useConnectedContext();
  const inventory = useInventory(connection);
  const target =
    worktree === undefined
      ? selectedWorktreeInProject(
          inventory,
          firstAvailableWorktree(inventory)?.id,
        )
      : selectedWorktreeInProject(inventory, worktree);
  if (target && settled)
    return (
      <Navigate
        to="/$projectId/$worktreeId"
        params={{ projectId: target.projectId, worktreeId: target.worktree.id }}
        search={worktree === undefined ? {} : search}
        replace
      />
    );
  return (
    <ConnectedWorkspace
      notice={
        worktree !== undefined && settled ? 'missing-worktree' : undefined
      }
      background={background}
    />
  );
}

type RemoteWorktreeProps = {
  environmentId: string;
  projectId: string;
  worktreeId: string;
  search: WorkspaceSearch;
  settled: boolean;
  background: boolean;
};

function RemoteWorktree(props: RemoteWorktreeProps) {
  const remote = useRemoteConnection(props.environmentId);
  if (!desktopShell || !remote) {
    if (!props.settled) return <WorkspacePending />;
    return (
      <Navigate
        to="/"
        search={{ ...props.search, worktree: props.worktreeId }}
        replace
      />
    );
  }
  return <RemoteStatusGate {...props} remote={remote} />;
}

function RemoteStatusGate({
  remote,
  ...shown
}: RemoteWorktreeProps & {
  remote: NonNullable<ReturnType<typeof useRemoteConnection>>;
}) {
  const statusAtom = remoteConnectionStatus(remote.remote.environmentId);
  const status = useAtomValue(statusAtom);
  const previouslyShown = useAtomValue(
    shownRemoteWorkspace(remote.remote.environmentId),
  );
  const showNotice = useAtomValue(remoteWorkspaceNotice(statusAtom));
  const interrupted = remoteWorktreeInterrupted(status.kind);
  if (status.kind === 'online' || (previouslyShown && interrupted))
    return (
      <WorktreeRoute
        projectId={shown.projectId}
        worktreeId={shown.worktreeId}
        search={shown.search}
        settled={shown.settled}
        background={shown.background}
        remote={remote}
        remoteStatus={statusAtom}
        showRemoteNotice={interrupted && showNotice}
      />
    );
  return (
    <ConnectedWorkspace
      remote={remote}
      {...(status.kind === 'checking'
        ? { connecting: true }
        : { unavailable: status })}
      background={shown.background}
    />
  );
}
